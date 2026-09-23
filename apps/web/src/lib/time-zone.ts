const FALLBACK_TIME_ZONE = 'UTC'

export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return FALLBACK_TIME_ZONE
  }
}
