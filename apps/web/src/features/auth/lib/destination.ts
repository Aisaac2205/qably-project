const DEFAULT_DESTINATION = '/dashboard'

export function resolveDestination(
  search: string,
  defaultDestination: string = DEFAULT_DESTINATION,
): string {
  const next = new URLSearchParams(search).get('next')

  if (next === null) return defaultDestination
  if (!next.startsWith('/') || next.startsWith('//')) return defaultDestination

  return next
}
