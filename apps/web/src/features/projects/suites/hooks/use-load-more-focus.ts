'use client'

import { useEffect, useRef } from 'react'

const ROW_LINK = 'a[href]'

interface UseLoadMoreFocusOptions {
  rowCount: number
  isFetching: boolean
}

interface PendingActivation {
  activator: HTMLElement
  hadFocus: boolean
  firstNewIndex: number
}

export function useLoadMoreFocus({ rowCount, isFetching }: UseLoadMoreFocusOptions) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const pendingRef = useRef<PendingActivation | null>(null)

  function markActivation(activator: HTMLElement) {
    pendingRef.current = {
      activator,
      hadFocus: document.activeElement === activator,
      firstNewIndex: rowCount,
    }
  }

  useEffect(() => {
    const pending = pendingRef.current

    if (pending === null || isFetching) return

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
  }, [isFetching, rowCount])

  return { listProps: { ref: listRef, tabIndex: -1 }, markActivation }
}
