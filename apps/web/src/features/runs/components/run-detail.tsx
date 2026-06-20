'use client'

import { useState, useCallback, useMemo } from 'react'
import type { Run, CaseStatus } from '@qably/types'
import { useKeyboardShortcuts } from '@/features/runs/hooks/use-keyboard-shortcuts'
import { useUpdateRunCase } from '@/features/runs/hooks/use-update-run-case'
import { RunProgressHeader } from './run-progress-header'
import { CaseList } from './case-list'
import { CaseDetail } from './case-detail'

const SHORTCUT_LABELS: Array<{ key: string; label: string }> = [
  { key: 'P', label: 'Pass' },
  { key: 'F', label: 'Fail' },
  { key: 'S', label: 'Skip' },
  { key: 'B', label: 'Blocked' },
  { key: 'R', label: 'Run next' },
  { key: '←→', label: 'Navigate' },
]

export function RunDetail({
  projectId,
  run,
}: {
  projectId: string
  run: Run
}) {
  const updateStatus = useUpdateRunCase(run.id)

  const sortedCases = useMemo(() => {
    // Keep original order; run.cases already has cases
    return run.cases
  }, [run.id, run.cases])

  const [selectedId, setSelectedId] = useState<string>(sortedCases[0]?.id ?? '')
  const [announcement, setAnnouncement] = useState('')

  const selectedIndex = sortedCases.findIndex((c) => c.id === selectedId)

  const selectCase = useCallback(
    (id: string) => {
      setSelectedId(id)
    },
    [],
  )

  const goNext = useCallback(() => {
    if (selectedIndex < sortedCases.length - 1) {
      setSelectedId(sortedCases[selectedIndex + 1].id)
    }
  }, [selectedIndex, sortedCases])

  const goPrev = useCallback(() => {
    if (selectedIndex > 0) {
      setSelectedId(sortedCases[selectedIndex - 1].id)
    }
  }, [selectedIndex, sortedCases])

  const setStatus = useCallback(
    (status: CaseStatus) => {
      if (!selectedId) return
      updateStatus(selectedId, status)
      const config: Record<string, string> = {
        pass: 'Pass',
        fail: 'Fail',
        skip: 'Skip',
        blocked: 'Blocked',
        running: 'Running',
        pending: 'Pending',
      }
      setAnnouncement(`Status: ${config[status] ?? status}`)
    },
    [selectedId, updateStatus],
  )

  const runNext = useCallback(() => {
    // Find the next pending case, starting from current index + 1
    for (let i = selectedIndex + 1; i < sortedCases.length; i++) {
      if (sortedCases[i].status === 'pending') {
        setSelectedId(sortedCases[i].id)
        updateStatus(sortedCases[i].id, 'running')
        setAnnouncement('Status: Running')
        return
      }
    }
    // Wrap around
    for (let i = 0; i < selectedIndex; i++) {
      if (sortedCases[i].status === 'pending') {
        setSelectedId(sortedCases[i].id)
        updateStatus(sortedCases[i].id, 'running')
        setAnnouncement('Status: Running')
        return
      }
    }
  }, [selectedIndex, sortedCases, updateStatus])

  useKeyboardShortcuts({
    p: () => setStatus('pass'),
    f: () => setStatus('fail'),
    s: () => setStatus('skip'),
    b: () => setStatus('blocked'),
    ArrowRight: () => goNext(),
    ArrowLeft: () => goPrev(),
    r: () => runNext(),
  })

  const selectedCase = sortedCases.find((c) => c.id === selectedId)

  return (
    <div className="h-full flex flex-col">
      <RunProgressHeader run={run} />

      {/* Keyboard shortcut hints */}
      <div
        className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-canvas/50"
        aria-label="Keyboard shortcuts"
      >
        {SHORTCUT_LABELS.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <kbd className="text-[10px] font-mono px-1 py-0.5 rounded bg-sidebar-hover text-sidebar-fg-muted border border-border-sidebar">
              {s.key}
            </kbd>
            <span className="text-[10px] text-muted">{s.label}</span>
          </span>
        ))}
      </div>

      {/* Screen reader announcement region */}
      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        {announcement}
      </div>

      {/* Two-pane: case list + detail */}
      <div className="flex-1 flex min-h-0">
        <div className="w-64 shrink-0 border-r border-border overflow-y-auto">
          <CaseList
            cases={sortedCases}
            selectedId={selectedId}
            onSelect={selectCase}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {selectedCase ? (
            <CaseDetail c={selectedCase} />
          ) : (
            <div className="flex items-center justify-center h-full text-[11px] text-muted p-4">
              Select a case to view details
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
