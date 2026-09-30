import { API_KEY_SCHEME } from '../../modules/api-keys/api-keys.contracts';
import { hasApiKeyTokenShape } from '../../modules/api-keys/lib/token';

export function readWellFormedApiKey(authorization: unknown): string | null {
  if (typeof authorization !== 'string') return null;

  const [scheme, token = ''] = authorization.split(' ');

  if (scheme !== API_KEY_SCHEME) return null;

  const candidate = token.trim();

  return hasApiKeyTokenShape(candidate) ? candidate : null;
}
