'use client'

import { useState } from 'react'
import { useTranslation } from '@/lib/i18n'

interface ResultsAnnouncementInput {
  resultsKey: string
  rowCount: number
  isSettled: boolean
  isFetchingMore: boolean
}

type Announcement = { kind: 'loadedMore' | 'shown'; count: number }

interface AnnouncementState {
  settledKey: string | null
  countBeforeFetch: number | null
  announcement: Announcement | null
}

const INITIAL_STATE: AnnouncementState = {
  settledKey: null,
  countBeforeFetch: null,
  announcement: null,
}

const MESSAGE_KEYS = {
  loadedMore: 'suites.loadedMoreSuites',
  shown: 'suites.suitesShown',
} as const

function advance(
  state: AnnouncementState,
  { resultsKey, rowCount, isSettled, isFetchingMore }: ResultsAnnouncementInput,
): AnnouncementState {
  if (isFetchingMore) {
    return state.countBeforeFetch !== null && state.announcement === null
      ? state
      : {
          ...state,
          countBeforeFetch: state.countBeforeFetch ?? rowCount,
          announcement: null,
        }
  }

  if (!isSettled) {
    return state.announcement === null ? state : { ...state, announcement: null }
  }

  if (state.settledKey === null) {
    return { settledKey: resultsKey, countBeforeFetch: null, announcement: null }
  }

  if (state.settledKey !== resultsKey) {
    return {
      settledKey: resultsKey,
      countBeforeFetch: null,
      announcement: { kind: 'shown', count: rowCount },
    }
  }

  if (state.countBeforeFetch !== null) {
    const added = rowCount - state.countBeforeFetch

    return {
      ...state,
      countBeforeFetch: null,
      announcement: added > 0 ? { kind: 'loadedMore', count: added } : null,
    }
  }

  return state
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
