function diffInCalendarMonths(then: Date, now: Date): number {
  return (
    (then.getFullYear() - now.getFullYear()) * 12 +
    (then.getMonth() - now.getMonth())
  )
}

function diffInCalendarYears(then: Date, now: Date): number {
  return then.getFullYear() - now.getFullYear()
}

export function formatRelative(
  iso: string | undefined,
  locale: string,
  never: string,
): string {
  if (!iso) return never

  const thenDate = new Date(iso)
  const then = thenDate.getTime()

  if (Number.isNaN(then)) return never

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const nowDate = new Date()
  const now = nowDate.getTime()
  const diffSec = Math.round((then - now) / 1000)
  const abs = Math.abs(diffSec)

  if (abs < 60) return rtf.format(diffSec, 'second')
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), 'hour')
  if (abs < 2592000) return rtf.format(Math.round(diffSec / 86400), 'day')
  if (abs < 31536000) {
    return rtf.format(diffInCalendarMonths(thenDate, nowDate), 'month')
  }

  return rtf.format(diffInCalendarYears(thenDate, nowDate), 'year')
}
