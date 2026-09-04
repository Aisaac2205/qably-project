'use client'

import { useState, useCallback, useMemo } from 'react'
import { LockSimple } from '@phosphor-icons/react'
import type { RunRecord, CaseStatus } from '@qably/types'
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
  run: RunRecord
}) {
  const { t } = useTranslation()
  const updateStatus = useUpdateRunCase(run.id)
  const isEditable = run.source === 'manual'

  const sortedCases = useMemo(() => run.cases, [run.cases])

  const [selectedId, setSelectedId] = useState<string>(sortedCases[0]?.id ?? '')
  const [announcement, setAnnouncement] = useState('')

  const selectedCase = sortedCases.find((c) => c.id === selectedId) ?? sortedCases[0]
  const activeCaseId = selectedCase?.id ?? ''
  const selectedIndex = sortedCases.findIndex((c) => c.id === activeCaseId)

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
      if (!activeCaseId) return
      updateStatus(activeCaseId, status)
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
    [activeCaseId, updateStatus, t],
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

  useKeyboardShortcuts(
    {
      p: () => setStatus('pass'),
      f: () => setStatus('fail'),
      s: () => setStatus('skip'),
      b: () => setStatus('blocked'),
      ArrowRight: () => goNext(),
      ArrowLeft: () => goPrev(),
      r: () => runNext(),
    },
    { enabled: isEditable },
  )

  const SOURCE_LABELS: Record<string, string> = {
    manual: 'runs.sourceManual',
    api: 'runs.sourceApi',
    github_actions: 'runs.sourceCi',
  }

  const SHORTCUT_LABELS: Array<{ key: string; label: string }> = [
    { key: 'P', label: t('runs.shortcutPass') },
    { key: 'F', label: t('runs.shortcutFail') },
    { key: 'S', label: t('runs.shortcutSkip') },
    { key: 'B', label: t('runs.shortcutBlocked') },
    { key: 'R', label: t('runs.shortcutRunNext') },
    { key: '←→', label: t('runs.shortcutNavigate') },
  ]

  return (
    <div className="space-y-6">
      <RunProgressHeader run={run} />

      {isEditable ? (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 rounded-xl border border-border bg-surface shadow-xs text-xs"
          aria-label={t('runs.keyboardShortcuts')}
        >
          <span className="text-xs font-semibold text-muted">
            {t('runs.shortcuts')}
          </span>
          {SHORTCUT_LABELS.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-default">
              <kbd className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded border border-border bg-surface-hover text-default shadow-sm min-w-[20px] text-center">
                {s.key}
              </kbd>
              <span className="text-muted">{s.label}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="flex items-start gap-2 px-4 py-2.5 rounded-xl border border-border bg-canvas/60 text-xs">
          <LockSimple
            size={14}
            weight="bold"
            className="mt-0.5 shrink-0 text-muted"
            aria-hidden="true"
          />
          <div className="space-y-0.5">
            <p className="font-semibold text-default">
              {t('runs.readOnlyRun', {
                source: t(SOURCE_LABELS[run.source] ?? 'runs.sourceApi'),
              })}
            </p>
            <p className="text-muted">{t('runs.readOnlyRunHint')}</p>
          </div>
        </div>
      )}

      {/* Screen reader announcement region */}
      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        {announcement}
      </div>

      {/* Two-pane workspace card: case list + detail */}
      <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden grid grid-cols-1 md:grid-cols-[280px_1fr] divide-y md:divide-y-0 md:divide-x divide-border min-h-[440px]">
        <div className="flex flex-col overflow-y-auto">
          <CaseList
            cases={sortedCases}
            selectedId={activeCaseId}
            onSelect={selectCase}
          />
        </div>
        <div className="flex flex-col overflow-y-auto">
          {selectedCase ? (
            <CaseDetail c={selectedCase} projectId={projectId} />
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
