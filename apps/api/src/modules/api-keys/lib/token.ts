import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const API_KEY_PREFIX = 'qbly';

const LOOKUP_BYTES = 6;
const SECRET_BYTES = 32;
const HASH_LENGTH = 64;
const TOKEN_PARTS = 3;

export interface GeneratedApiKey {
  token: string;
  lookupId: string;
  secret: string;
  lastFour: string;
}

export interface ParsedApiKey {
  lookupId: string;
  secret: string;
}

export function generateApiKeyToken(): GeneratedApiKey {
  const lookupId = randomBytes(LOOKUP_BYTES).toString('hex');
  const secret = randomBytes(SECRET_BYTES).toString('hex');
  const token = `${API_KEY_PREFIX}_${lookupId}_${secret}`;

  return { token, lookupId, secret, lastFour: token.slice(-4) };
}

export function parseApiKeyToken(token: string): ParsedApiKey | null {
  const parts = token.split('_');

  if (parts.length !== TOKEN_PARTS) return null;

  const [prefix, lookupId, secret] = parts;

  if (prefix !== API_KEY_PREFIX) return null;
  if (lookupId === '' || secret === '') return null;

  return { lookupId, secret };
}

export function hashApiKeySecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function secretMatches(secret: string, storedHash: string): boolean {
  if (storedHash.length !== HASH_LENGTH) return false;

  const candidate = Buffer.from(hashApiKeySecret(secret), 'hex');
  const stored = Buffer.from(storedHash, 'hex');

  if (candidate.length !== stored.length) return false;

  return timingSafeEqual(candidate, stored);
}
