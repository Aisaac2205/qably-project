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
  eventId: number
}

interface ResultsAnnouncement {
  message: string
  eventId: number
}

const INITIAL_STATE: AnnouncementState = {
  settled: null,
  announcement: null,
  failedLoad: false,
  eventId: 0,
}

const MESSAGE_KEYS = {
  loadedMore: 'suites.loadedMoreSuites',
  shown: 'suites.suitesShown',
} as const

function settle(
  state: AnnouncementState,
  settled: SettledResults,
  announcement: Announcement | null,
): AnnouncementState {
  return {
    settled,
    announcement,
    failedLoad: false,
    eventId: announcement === null ? state.eventId : state.eventId + 1,
  }
}

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
    return settle(state, current, state.failedLoad ? shown : null)
  }

  if (state.settled.key !== resultsKey) {
    return settle(state, current, shown)
  }

  if (pageCount > state.settled.pageCount) {
    const added = rowCount - state.settled.rowCount

    return settle(state, current, added > 0 ? { kind: 'loadedMore', count: added } : null)
  }

  const unchanged =
    state.settled.rowCount === rowCount && state.settled.pageCount === pageCount

  if (unchanged) return state.failedLoad ? { ...state, failedLoad: false } : state

  return { ...state, settled: current, failedLoad: false }
}

export function useResultsAnnouncement(input: ResultsAnnouncementInput): ResultsAnnouncement {
  const { t } = useTranslation()
  const [state, setState] = useState(INITIAL_STATE)
  const next = advance(state, input)

  if (next !== state) setState(next)

  return {
    message:
      next.announcement === null
        ? ''
        : t(MESSAGE_KEYS[next.announcement.kind], { count: next.announcement.count }),
    eventId: next.eventId,
  }
}
