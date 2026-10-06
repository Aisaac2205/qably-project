'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'

interface ResultsAnnouncementInput {
  resultsKey: string
  rowCount: number
  pageCount: number
  isSettled: boolean
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
}

const INITIAL_STATE: AnnouncementState = {
  settled: null,
  announcement: null,
}

const MESSAGE_KEYS = {
  loadedMore: 'suites.loadedMoreSuites',
  shown: 'suites.suitesShown',
} as const

function advance(
  state: AnnouncementState,
  { resultsKey, rowCount, pageCount, isSettled }: ResultsAnnouncementInput,
): AnnouncementState {
  if (!isSettled) {
    return state.announcement === null ? state : { ...state, announcement: null }
  }

  const current: SettledResults = { key: resultsKey, rowCount, pageCount }

  if (state.settled === null) {
    return { settled: current, announcement: null }
  }

  if (state.settled.key !== resultsKey) {
    return { settled: current, announcement: { kind: 'shown', count: rowCount } }
  }

  if (pageCount > state.settled.pageCount) {
    const added = rowCount - state.settled.rowCount

    return {
      settled: current,
      announcement: added > 0 ? { kind: 'loadedMore', count: added } : null,
    }
  }

  const unchanged =
    state.settled.rowCount === rowCount && state.settled.pageCount === pageCount

  return unchanged ? state : { ...state, settled: current }
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
