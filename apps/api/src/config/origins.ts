export function toOrigin(rawUrl: string): string {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`"${rawUrl}" is not a url: use an absolute http(s) url`);
  }

  if (parsed.origin === 'null') {
    throw new Error(
      `"${rawUrl}" has no comparable origin: use an absolute http(s) url`,
    );
  }

  return parsed.origin;
}

export function resolveAllowedOrigins(...rawUrls: string[]): string[] {
  return [...new Set(rawUrls.map(toOrigin))];
}
