'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import type { Run, CaseStatus } from '@qably/types'
import { useRun, useProject } from '@/lib/use-mock-store'
import { Breadcrumbs } from '@/components/shell/breadcrumbs'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from '@phosphor-icons/react'
import Link from 'next/link'
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

  const sortedCases = useMemo(() => run.cases, [run.id, run.cases])

  const [selectedId, setSelectedId] = useState<string>(sortedCases[0]?.id ?? '')
  const [announcement, setAnnouncement] = useState('')

  // If the selected case no longer exists (e.g. after a refetch), fall back to the first.
  useEffect(() => {
    if (selectedId && !sortedCases.find((c) => c.id === selectedId)) {
      setSelectedId(sortedCases[0]?.id ?? '')
    }
  }, [sortedCases, selectedId])

  const selectedIndex = sortedCases.findIndex((c) => c.id === selectedId)

  const selectCase = useCallback((id: string) => setSelectedId(id), [])

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
    for (let i = selectedIndex + 1; i < sortedCases.length; i++) {
      if (sortedCases[i].status === 'pending') {
        setSelectedId(sortedCases[i].id)
        updateStatus(sortedCases[i].id, 'running')
        setAnnouncement('Status: Running')
        return
      }
    }
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

      {/* Keyboard shortcut hints — using surface tokens (not sidebar), readable text-xs */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 border-b border-border bg-canvas"
        aria-label="Keyboard shortcuts"
      >
        <span className="text-[11px] uppercase tracking-wide text-muted font-semibold">
          Shortcuts
        </span>
        {SHORTCUT_LABELS.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-default">
            <kbd className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded border border-border bg-surface text-default shadow-sm min-w-[20px] text-center">
              {s.key}
            </kbd>
            <span className="text-muted">{s.label}</span>
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
        <div className="w-72 shrink-0 border-r border-border overflow-y-auto">
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
            <div className="flex flex-col items-center justify-center h-full text-sm text-muted p-8 gap-2 text-center">
              <p className="text-sm font-medium text-default">No case selected</p>
              <p>Pick a case from the list to view its details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
