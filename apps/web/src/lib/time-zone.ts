import { useSyncExternalStore } from 'react'

const FALLBACK_TIME_ZONE = 'UTC'

export function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return FALLBACK_TIME_ZONE
  }
}

function subscribeToTimeZone(): () => void {
  return () => undefined
}

function getServerTimeZoneSnapshot(): undefined {
  return undefined
}

export function useBrowserTimeZone(): string | undefined {
  return useSyncExternalStore(
    subscribeToTimeZone,
    getBrowserTimeZone,
    getServerTimeZoneSnapshot,
  )
}
