'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'

interface ResultsAnnouncementInput {
  resultsKey: string
  rowCount: number
  pageCount: number
  isSettled: boolean
  hasFailed: boolean
}

type Announcement = { kind: 'loadedMore' | 'shown'; count: number }

interface SettledResults {
  key: string
  rowCount: number
  pageCount: number
}

interface AnnouncementState {
  settled: SettledResults | null
  announcement: Announcement | null
  failedLoad: boolean
}

const INITIAL_STATE: AnnouncementState = {
  settled: null,
  announcement: null,
  failedLoad: false,
}

const MESSAGE_KEYS = {
  loadedMore: 'suites.loadedMoreSuites',
  shown: 'suites.suitesShown',
} as const

function advance(
  state: AnnouncementState,
  { resultsKey, rowCount, pageCount, isSettled, hasFailed }: ResultsAnnouncementInput,
): AnnouncementState {
  if (!isSettled) {
    const failedLoad = state.failedLoad || hasFailed

    return failedLoad === state.failedLoad && state.announcement === null
      ? state
      : { ...state, failedLoad, announcement: null }
  }

  const current: SettledResults = { key: resultsKey, rowCount, pageCount }
  const shown: Announcement = { kind: 'shown', count: rowCount }

  if (state.settled === null) {
    return { settled: current, announcement: state.failedLoad ? shown : null, failedLoad: false }
  }

  if (state.settled.key !== resultsKey) {
    return { settled: current, announcement: shown, failedLoad: false }
  }

  if (pageCount > state.settled.pageCount) {
    const added = rowCount - state.settled.rowCount

    return {
      settled: current,
      announcement: added > 0 ? { kind: 'loadedMore', count: added } : null,
      failedLoad: false,
    }
  }

  const unchanged =
    state.settled.rowCount === rowCount && state.settled.pageCount === pageCount

  if (unchanged) return state.failedLoad ? { ...state, failedLoad: false } : state

  return { ...state, settled: current, failedLoad: false }
}

export function useResultsAnnouncement(input: ResultsAnnouncementInput): string {
  const { t } = useTranslation()
  const [state, setState] = useState(INITIAL_STATE)
  const next = advance(state, input)

  if (next !== state) setState(next)

  return next.announcement === null
    ? ''
    : t(MESSAGE_KEYS[next.announcement.kind], { count: next.announcement.count })
}
