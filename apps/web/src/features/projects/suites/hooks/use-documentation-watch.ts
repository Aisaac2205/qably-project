'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DOCUMENTATION_WATCH_WINDOW_MS,
  beginWatch,
  deriveWatchStatus,
  documentedSince,
  observeWatch,
  pollIntervalFor,
  resumeWatch,
  type DocumentationWatch,
  type DocumentationWatchStatus,
} from '../lib/documentation-watch'

export interface DocumentationWatchState<TMode extends string = string> {
  mode: TMode | undefined
  statusFor: (isDocumenting: boolean) => DocumentationWatchStatus
  intervalFor: (isDocumenting: boolean) => number | false
  documentedCountSince: (currentCount: number | undefined) => number
  begin: (baselineCount: number, mode?: TMode) => void
  resume: (baselineCount: number, mode?: TMode) => void
  observe: (isDocumenting: boolean) => void
  dismiss: () => void
}

interface TrackedWatch<TMode extends string> {
  watch: DocumentationWatch
  mode: TMode | undefined
}

export function useDocumentationWatch<TMode extends string = string>(
  windowMs: number = DOCUMENTATION_WATCH_WINDOW_MS,
): DocumentationWatchState<TMode> {
  const [tracked, setTracked] = useState<TrackedWatch<TMode> | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const watch = tracked?.watch ?? null

  useEffect(() => {
    if (watch === null) return

    const remaining = Math.max(watch.startedAt + windowMs - Date.now(), 0)
    const timer = setTimeout(() => setNow(Date.now()), remaining)

    return () => clearTimeout(timer)
  }, [watch, windowMs])

  const begin = useCallback((baselineCount: number, mode?: TMode) => {
    const startedAt = Date.now()
    setNow(startedAt)
    setTracked({ watch: beginWatch(startedAt, baselineCount), mode })
  }, [])

  // Picks up a run that was already in progress before this screen started
  // watching. It never replaces a running watch, so an accepted run keeps its
  // window, baseline and mode.
  const resume = useCallback((baselineCount: number, mode?: TMode) => {
    const startedAt = Date.now()
    setTracked((current) => current ?? { watch: resumeWatch(startedAt, baselineCount), mode })
  }, [])

  const observe = useCallback((isDocumenting: boolean) => {
    setTracked((current) => {
      if (current === null) return current
      const next = observeWatch(current.watch, isDocumenting)
      return next === current.watch ? current : { ...current, watch: next }
    })
  }, [])

  const dismiss = useCallback(() => setTracked(null), [])

  const statusFor = useCallback(
    (isDocumenting: boolean) =>
      deriveWatchStatus(watch, isDocumenting, now, windowMs),
    [watch, now, windowMs],
  )

  const intervalFor = useCallback(
    (isDocumenting: boolean) =>
      pollIntervalFor(
        deriveWatchStatus(watch, isDocumenting, Date.now(), windowMs),
      ),
    [watch, windowMs],
  )

  const documentedCountSince = useCallback(
    (currentCount: number | undefined) => documentedSince(watch, currentCount),
    [watch],
  )

  return {
    mode: tracked?.mode,
    statusFor,
    intervalFor,
    documentedCountSince,
    begin,
    resume,
    observe,
    dismiss,
  }
}
