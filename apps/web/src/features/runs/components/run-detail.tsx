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
import { useTranslation } from '@/lib/i18n'

export function RunDetail({
  projectId,
  run,
}: {
  projectId: string
  run: Run
}) {
  const { t } = useTranslation()
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
        pass: t('runs.statusPass'),
        fail: t('runs.statusFail'),
        skip: t('runs.statusSkip'),
        blocked: t('runs.statusBlocked'),
        running: t('runs.statusRunning'),
        pending: t('runs.statusPending'),
      }
      setAnnouncement(t('runs.statusAnnouncement', { status: config[status] ?? status }))
    },
    [selectedId, updateStatus, t],
  )

  const runNext = useCallback(() => {
    for (let i = selectedIndex + 1; i < sortedCases.length; i++) {
      if (sortedCases[i].status === 'pending') {
        setSelectedId(sortedCases[i].id)
        updateStatus(sortedCases[i].id, 'running')
        setAnnouncement(t('runs.statusAnnouncement', { status: t('runs.statusRunning') }))
        return
      }
    }
    for (let i = 0; i < selectedIndex; i++) {
      if (sortedCases[i].status === 'pending') {
        setSelectedId(sortedCases[i].id)
        updateStatus(sortedCases[i].id, 'running')
        setAnnouncement(t('runs.statusAnnouncement', { status: t('runs.statusRunning') }))
        return
      }
    }
  }, [selectedIndex, sortedCases, updateStatus, t])

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

  const SHORTCUT_LABELS: Array<{ key: string; label: string }> = [
    { key: 'P', label: t('runs.shortcutPass') },
    { key: 'F', label: t('runs.shortcutFail') },
    { key: 'S', label: t('runs.shortcutSkip') },
    { key: 'B', label: t('runs.shortcutBlocked') },
    { key: 'R', label: t('runs.shortcutRunNext') },
    { key: '←→', label: t('runs.shortcutNavigate') },
  ]

  return (
    <div className="h-full flex flex-col">
      <RunProgressHeader run={run} />

      {/* Keyboard shortcut hints — using surface tokens (not sidebar), readable text-xs */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 border-b border-border bg-canvas"
        aria-label={t('runs.keyboardShortcuts')}
      >
        <span className="text-[11px] uppercase tracking-wide text-muted font-semibold">
          {t('runs.shortcuts')}
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
              <p className="text-sm font-medium text-default">{t('runs.noCaseSelected')}</p>
              <p>{t('runs.pickCaseHint')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
