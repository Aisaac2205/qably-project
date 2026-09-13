'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DOCUMENTATION_WATCH_WINDOW_MS,
  deriveWatchStatus,
  documentedSince,
  pollIntervalFor,
  type DocumentationWatch,
  type DocumentationWatchStatus,
} from '../lib/documentation-watch'

export interface DocumentationWatchState {
  statusFor: (currentCount: number | undefined) => DocumentationWatchStatus
  intervalFor: (currentCount: number | undefined) => number | false
  documentedCountSince: (currentCount: number | undefined) => number
  begin: (baselineCount: number) => void
  dismiss: () => void
}

export function useDocumentationWatch(
  windowMs: number = DOCUMENTATION_WATCH_WINDOW_MS,
): DocumentationWatchState {
  const [watch, setWatch] = useState<DocumentationWatch | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (watch === null) return

    const remaining = Math.max(watch.startedAt + windowMs - Date.now(), 0)
    const timer = setTimeout(() => setNow(Date.now()), remaining)

    return () => clearTimeout(timer)
  }, [watch, windowMs])

  const begin = useCallback((baselineCount: number) => {
    const startedAt = Date.now()
    setNow(startedAt)
    setWatch({ startedAt, baselineCount })
  }, [])

  const dismiss = useCallback(() => setWatch(null), [])

  const statusFor = useCallback(
    (currentCount: number | undefined) =>
      deriveWatchStatus(watch, currentCount, now, windowMs),
    [watch, now, windowMs],
  )

  const intervalFor = useCallback(
    (currentCount: number | undefined) =>
      pollIntervalFor(
        deriveWatchStatus(watch, currentCount, Date.now(), windowMs),
      ),
    [watch, windowMs],
  )

  const documentedCountSince = useCallback(
    (currentCount: number | undefined) => documentedSince(watch, currentCount),
    [watch],
  )

  return { statusFor, intervalFor, documentedCountSince, begin, dismiss }
}
