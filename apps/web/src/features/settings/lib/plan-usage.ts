import type { Locale } from '@/lib/i18n'

export function usagePercent(used: number, limit: number | null): number | null {
  if (limit === null) return null
  if (limit <= 0) return 100

  return Math.min(100, Math.max(0, Math.round((used / limit) * 100)))
}

export function formatCreditsReset(iso: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}
