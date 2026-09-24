'use client'

import { useCallback, useMemo, useState } from 'react'

export interface UseBulkSelectionResult {
  selectedIds: Set<string>
  toggle: (id: string) => void
  toggleAll: (ids: string[]) => void
  clear: () => void
}

export function useBulkSelection(): UseBulkSelectionResult {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id))
      return allSelected ? new Set() : new Set(ids)
    })
  }, [])

  const clear = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  return useMemo(
    () => ({ selectedIds, toggle, toggleAll, clear }),
    [selectedIds, toggle, toggleAll, clear],
  )
}
