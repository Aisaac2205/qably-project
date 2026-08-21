export function resolveApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL

  if (!raw) {
    throw new Error(
      'NEXT_PUBLIC_API_URL is not set: point it at the Qably API origin, for example http://localhost:3001',
    )
  }

  let parsed: URL

  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(`NEXT_PUBLIC_API_URL is not a url: received "${raw}"`)
  }

  if (parsed.origin === 'null') {
    throw new Error(
      `NEXT_PUBLIC_API_URL has no comparable origin: received "${raw}"`,
    )
  }

  return parsed.origin
}
