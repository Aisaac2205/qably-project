const DEFAULT_DESTINATION = '/dashboard'

export function resolveDestination(search: string): string {
  const next = new URLSearchParams(search).get('next')

  if (next === null) return DEFAULT_DESTINATION
  if (!next.startsWith('/') || next.startsWith('//')) return DEFAULT_DESTINATION

  return next
}
