export function getApiBaseUrl(): string {
  const raw =
    (typeof import.meta !== 'undefined' ? import.meta.env?.PUBLIC_API_URL : undefined) ??
    (typeof process !== 'undefined' ? process.env?.PUBLIC_API_URL : undefined);

  if (!raw) {
    throw new Error(
      'PUBLIC_API_URL is not set: point it at the Qably API origin, for example https://api.qably.dev',
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`PUBLIC_API_URL is not a url: received "${raw}"`);
  }

  if (parsed.origin === 'null') {
    throw new Error(`PUBLIC_API_URL has no comparable origin: received "${raw}"`);
  }

  return parsed.origin;
}
