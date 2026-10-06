'use client'

import { useCallback, useEffect, useRef } from 'react'
import { isFocusFree } from '@/features/projects/suites/lib/is-focus-free'

const ROW_LINK = 'a[href]'

interface UseLoadMoreFocusOptions {
  rowCount: number
  pageCount: number
  resultsKey: string
  hasFailed: boolean
}

interface PendingActivation {
  activator: HTMLElement
  hadFocus: boolean
  firstNewIndex: number
  pageCount: number
  resultsKey: string
}

export function useLoadMoreFocus({
  rowCount,
  pageCount,
  resultsKey,
  hasFailed,
}: UseLoadMoreFocusOptions) {
  const listRef = useRef<HTMLElement | null>(null)
  const pendingRef = useRef<PendingActivation | null>(null)
  const setList = useCallback((node: HTMLElement | null) => {
    listRef.current = node
  }, [])

  function markActivation(activator: HTMLElement) {
    pendingRef.current = {
      activator,
      hadFocus: document.activeElement === activator,
      firstNewIndex: rowCount,
      pageCount,
      resultsKey,
    }
  }

  useEffect(() => {
    if (hasFailed) pendingRef.current = null
  }, [hasFailed])

  useEffect(() => {
    const pending = pendingRef.current

    if (pending === null) return

    if (pending.resultsKey !== resultsKey) {
      pendingRef.current = null
      return
    }

    if (pageCount <= pending.pageCount) return

    pendingRef.current = null

    if (!pending.hadFocus || !isFocusFree(pending.activator)) return

    const firstNewRow =
      rowCount > pending.firstNewIndex
        ? listRef.current?.querySelectorAll<HTMLElement>(ROW_LINK)[pending.firstNewIndex]
        : undefined

    if (firstNewRow !== undefined) {
      firstNewRow.focus()
      return
    }

    if (!pending.activator.isConnected) listRef.current?.focus()
  }, [pageCount, rowCount, resultsKey])

  return { listProps: { ref: setList, tabIndex: -1 }, markActivation }
}
