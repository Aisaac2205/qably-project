import type { Request } from 'express';
import type { ApiKey, ApiKeyWithSecret } from '@qably/types';

export type ApiKeyView = ApiKey;

export type ApiKeyWithSecretView = ApiKeyWithSecret;

export type ApiKeyError = 'not-found' | 'forbidden';

export interface ApiKeyIdentity {
  apiKeyId: string;
  projectId: string;
  organizationId: string;
}

export interface RequestWithApiKey extends Request {
  apiKey?: ApiKeyIdentity;
}

export const API_KEY_SCHEME = 'Bearer';
