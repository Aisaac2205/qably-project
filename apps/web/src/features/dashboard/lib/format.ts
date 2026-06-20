/**
 * Dashboard formatting helpers. Pure functions — no React.
 */

export function formatRelativeTime(iso: string, now?: number): string {
  const then = new Date(iso).getTime()
  const current = now ?? Date.now()
  const diffMs = current - then
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return 'just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`

  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatPassRate(rate: number): string {
  return `${Math.round(rate)}%`
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}
