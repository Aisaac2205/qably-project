export type FormatLocale = 'es' | 'en'

const RELATIVE_TIME_COPY = {
  en: {
    justNow: 'just now',
    minutes: (n: number) => `${n}m ago`,
    hours: (n: number) => `${n}h ago`,
    days: (n: number) => `${n}d ago`,
    dateTag: 'en-US',
  },
  es: {
    justNow: 'ahora',
    minutes: (n: number) => `hace ${n} min`,
    hours: (n: number) => `hace ${n} h`,
    days: (n: number) => `hace ${n} d`,
    dateTag: 'es-ES',
  },
} as const

export function formatRelativeTime(
  iso: string,
  locale: FormatLocale,
  now?: number,
): string {
  const copy = RELATIVE_TIME_COPY[locale] ?? RELATIVE_TIME_COPY.en
  const then = new Date(iso).getTime()
  const current = now ?? Date.now()
  const diffSeconds = Math.floor((current - then) / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return copy.justNow
  if (diffMinutes < 60) return copy.minutes(diffMinutes)
  if (diffHours < 24) return copy.hours(diffHours)
  if (diffDays < 30) return copy.days(diffDays)

  return new Date(iso).toLocaleDateString(copy.dateTag, {
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

export function formatCompactNumber(value: number, locale: 'es' | 'en'): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function formatEventCount(value: number, locale: 'es' | 'en'): string {
  const separator = locale === 'es' ? '.' : ','
  const sign = value < 0 ? '-' : ''
  const digits = Math.trunc(Math.abs(value)).toString()

  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
}

export function formatRunDuration(ms: number): string {
  const totalSeconds = Math.round(Math.abs(ms) / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`
}

export type DashboardKpiMetric = 'passRate' | 'runs' | 'failedCases' | 'avgRunDurationMs'

export function formatKpiValue(metric: DashboardKpiMetric, value: number | null): string {
  if (value === null) return '—'

  switch (metric) {
    case 'passRate':
      return `${Math.round(value * 100)}%`
    case 'avgRunDurationMs':
      return formatRunDuration(value)
    case 'runs':
    case 'failedCases':
      return formatNumber(value)
  }
}

export function formatKpiDelta(
  metric: DashboardKpiMetric,
  value: number | null,
  previous: number | null,
): string | null {
  if (value === null || previous === null) return null

  const diff = metric === 'passRate' ? Math.round(value * 100) - Math.round(previous * 100) : value - previous
  const magnitude = Math.abs(diff)
  const arrow = diff > 0 ? '↑ ' : diff < 0 ? '↓ ' : ''

  if (metric === 'passRate') return `${arrow}${magnitude} pts`
  if (metric === 'avgRunDurationMs') return `${arrow}${formatRunDuration(magnitude)}`
  return `${arrow}${formatNumber(magnitude)}`
}
