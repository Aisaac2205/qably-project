/**
 * Dashboard formatting helpers. Pure functions — no React.
 */

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

export function formatEventCount(value: number, locale: 'es' | 'en'): string {
  const separator = locale === 'es' ? '.' : ','
  const sign = value < 0 ? '-' : ''
  const digits = Math.trunc(Math.abs(value)).toString()

  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator)
}
