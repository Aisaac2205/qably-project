import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { InjectEnv } from '../../config/config.tokens';
import type { Env } from '../../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SEGMENT_COUNT = 3;
const SECRET_LENGTH = 32;

@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(@InjectEnv() env: Env) {
    this.key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  }

  generateSecret(): string {
    return randomBytes(SECRET_LENGTH).toString('hex');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      iv.toString('hex'),
      authTag.toString('hex'),
      ciphertext.toString('hex'),
    ].join(':');
  }

  decrypt(packed: string): string {
    const segments = packed.split(':');

    if (segments.length !== SEGMENT_COUNT) {
      throw new Error('Malformed encrypted payload');
    }

    const [ivHex, authTagHex, ciphertextHex] = segments as [
      string,
      string,
      string,
    ];

    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }
}
