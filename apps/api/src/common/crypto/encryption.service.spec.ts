import type { Env } from '../../config/env';
import { EncryptionService } from './encryption.service';

const env: Env = {
  NODE_ENV: 'test',
  PORT: 3001,
  DATABASE_URL: 'postgresql://qably:qably@localhost:5432/qably',
  REDIS_URL: 'redis://localhost:6379',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  BETTER_AUTH_URL: 'http://localhost:3001',
  WEB_APP_URL: 'http://localhost:3000',
  ENCRYPTION_KEY: 'a'.repeat(64),
  GITHUB_CLIENT_ID: 'gh-client-id',
  GITHUB_CLIENT_SECRET: 'gh-client-secret',
};

function build(): EncryptionService {
  return new EncryptionService(env);
}

function flipLastByte(hex: string): string {
  const lastByte = hex.slice(-2);
  const replacement = lastByte === '00' ? '11' : '00';
  return hex.slice(0, -2) + replacement;
}

describe('EncryptionService', () => {
  it('round-trips a plaintext through encrypt and decrypt', () => {
    const service = build();

    const packed = service.encrypt('ghp_super-secret-token');

    expect(service.decrypt(packed)).toBe('ghp_super-secret-token');
  });

  it('produces a different ciphertext for the same plaintext on each call', () => {
    const service = build();

    const first = service.encrypt('ghp_super-secret-token');
    const second = service.encrypt('ghp_super-secret-token');

    expect(first).not.toBe(second);
  });

  it('fails to decrypt when the ciphertext has been tampered with', () => {
    const service = build();
    const packed = service.encrypt('ghp_super-secret-token');
    const [iv, authTag, ciphertext] = packed.split(':');

    const tampered = [iv, authTag, flipLastByte(ciphertext)].join(':');

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('fails to decrypt when the auth tag has been tampered with', () => {
    const service = build();
    const packed = service.encrypt('ghp_super-secret-token');
    const [iv, authTag, ciphertext] = packed.split(':');

    const tampered = [iv, flipLastByte(authTag), ciphertext].join(':');

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('rejects a malformed payload missing a segment', () => {
    const service = build();

    expect(() => service.decrypt('only-one-part')).toThrow();
  });
});

describe('EncryptionService.generateSecret', () => {
  it('returns 64 hexadecimal characters', () => {
    const secret = build().generateSecret();

    expect(secret).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns a different secret on each call', () => {
    const service = build();

    expect(service.generateSecret()).not.toBe(service.generateSecret());
  });
});
