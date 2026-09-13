export type DocumentationWatchStatus = 'idle' | 'working' | 'settled' | 'timed-out'

export const DOCUMENTATION_POLL_INTERVAL_MS = 3_000
export const DOCUMENTATION_WATCH_WINDOW_MS = 90_000

export interface DocumentationWatch {
  startedAt: number
  baselineCount: number
}

export function deriveWatchStatus(
  watch: DocumentationWatch | null,
  currentCount: number | undefined,
  now: number,
  windowMs: number = DOCUMENTATION_WATCH_WINDOW_MS,
): DocumentationWatchStatus {
  if (watch === null) return 'idle'
  if (currentCount !== undefined && currentCount < watch.baselineCount) {
    return 'settled'
  }
  if (now - watch.startedAt >= windowMs) return 'timed-out'
  return 'working'
}

export function pollIntervalFor(
  status: DocumentationWatchStatus,
): number | false {
  return status === 'working' ? DOCUMENTATION_POLL_INTERVAL_MS : false
}

export function documentedSince(
  watch: DocumentationWatch | null,
  currentCount: number | undefined,
): number {
  if (watch === null || currentCount === undefined) return 0
  return Math.max(watch.baselineCount - currentCount, 0)
}
