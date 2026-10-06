'use client'

import { useCallback, useEffect, useRef } from 'react'

const ROW_LINK = 'a[href]'

interface UseLoadMoreFocusOptions {
  rowCount: number
  pageCount: number
}

interface PendingActivation {
  activator: HTMLElement
  hadFocus: boolean
  firstNewIndex: number
  pageCount: number
}

export function useLoadMoreFocus({ rowCount, pageCount }: UseLoadMoreFocusOptions) {
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
    }
  }

  useEffect(() => {
    const pending = pendingRef.current

    if (pending === null || pageCount <= pending.pageCount) return

    pendingRef.current = null

    if (!pending.hadFocus) return

    const active = document.activeElement
    const focusIsFree =
      active === null || active === document.body || active === pending.activator

    if (!focusIsFree) return

    const firstNewRow =
      rowCount > pending.firstNewIndex
        ? listRef.current?.querySelectorAll<HTMLElement>(ROW_LINK)[pending.firstNewIndex]
        : undefined

    if (firstNewRow !== undefined) {
      firstNewRow.focus()
      return
    }

    if (!pending.activator.isConnected) listRef.current?.focus()
  }, [pageCount, rowCount])

  return { listProps: { ref: setList, tabIndex: -1 }, markActivation }
}
