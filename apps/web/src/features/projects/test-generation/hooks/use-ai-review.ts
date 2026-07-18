'use client'

import { useState, useCallback, useMemo } from 'react'
import { useAiCases } from '@/lib/use-mock-store'
import { confirmAiCase, rejectAiCase, skipAiCase, confirmAllPending } from '@/lib/mock-store'

export function useAiReview(projectId: string) {
  const allCases = useAiCases(projectId)
  const pending = useMemo(
    () => allCases.filter((c) => c.reviewStatus === 'pending'),
    [allCases],
  )

  const [selectedId, setSelectedId] = useState<string>(pending[0]?.id ?? '')

  const selectedCase = useMemo(
    () => pending.find((c) => c.id === selectedId) ?? null,
    [pending, selectedId],
  )

  const selectCase = useCallback((id: string) => {
    setSelectedId(id)
  }, [])

  const confirmSelected = useCallback(() => {
    if (!selectedId) return
    confirmAiCase(selectedId)
    // Select next pending case
    const idx = pending.findIndex((c) => c.id === selectedId)
    if (idx >= 0) {
      const filtered = pending.filter((c) => c.id !== selectedId)
      // Next one after removal
      setSelectedId(filtered[Math.min(idx, filtered.length - 1)]?.id ?? '')
    }
  }, [selectedId, pending])

  const rejectSelected = useCallback(() => {
    if (!selectedId) return
    rejectAiCase(selectedId)
    const idx = pending.findIndex((c) => c.id === selectedId)
    if (idx >= 0) {
      const filtered = pending.filter((c) => c.id !== selectedId)
      setSelectedId(filtered[Math.min(idx, filtered.length - 1)]?.id ?? '')
    }
  }, [selectedId, pending])

  const skipSelected = useCallback(() => {
    if (!selectedId) return
    skipAiCase(selectedId)
    const idx = pending.findIndex((c) => c.id === selectedId)
    if (idx >= 0) {
      const filtered = pending.filter((c) => c.id !== selectedId)
      setSelectedId(filtered[Math.min(idx, filtered.length - 1)]?.id ?? '')
    }
  }, [selectedId, pending])

  const confirmAll = useCallback(() => {
    confirmAllPending(projectId)
    setSelectedId('')
  }, [projectId])

  return {
    cases: pending,
    selectedCase,
    selectCase,
    confirmSelected,
    rejectSelected,
    skipSelected,
    confirmAll,
  }
}
