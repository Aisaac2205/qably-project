export type DocumentationWatchStatus = 'idle' | 'working' | 'settled' | 'timed-out'

export const DOCUMENTATION_POLL_INTERVAL_MS = 3_000
export const DOCUMENTATION_WATCH_WINDOW_MS = 90_000
export const DOCUMENTATION_SETTLE_GRACE_POLLS = 2

export interface DocumentationWatch {
  startedAt: number
  baselineCount: number
  sawBusy: boolean
  idlePolls: number
}

export function beginWatch(startedAt: number, baselineCount: number): DocumentationWatch {
  return { startedAt, baselineCount, sawBusy: false, idlePolls: 0 }
}

export function observeWatch(
  watch: DocumentationWatch,
  isDocumenting: boolean,
): DocumentationWatch {
  if (isDocumenting) {
    return watch.sawBusy ? watch : { ...watch, sawBusy: true }
  }
  return watch.sawBusy ? watch : { ...watch, idlePolls: watch.idlePolls + 1 }
}

export function deriveWatchStatus(
  watch: DocumentationWatch | null,
  isDocumenting: boolean,
  now: number,
  windowMs: number = DOCUMENTATION_WATCH_WINDOW_MS,
): DocumentationWatchStatus {
  if (watch === null) return 'idle'
  if (isDocumenting) {
    if (now - watch.startedAt >= windowMs) return 'timed-out'
    return 'working'
  }
  if (watch.sawBusy) return 'settled'
  if (watch.idlePolls >= DOCUMENTATION_SETTLE_GRACE_POLLS) return 'settled'
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
