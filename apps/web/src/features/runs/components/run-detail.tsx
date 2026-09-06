'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { LockSimple } from '@phosphor-icons/react'
import type { RunRecord, CaseStatus } from '@qably/types'
import { useKeyboardShortcuts } from '@/features/runs/hooks/use-keyboard-shortcuts'
import { useUpdateRunCase } from '@/features/runs/hooks/use-update-run-case'
import { useSuite } from '@/features/projects/suites/hooks/use-suites'
import { describeCase } from '@/features/projects/suites/lib/case-title'
import { ApiError } from '@/lib/api-client'
import { RunProgressHeader } from './run-progress-header'
import { CaseList } from './case-list'
import { CaseDetail } from './case-detail'
import { StatusChip } from '@/components/ui/status-chip'
import { useTranslation } from '@/lib/i18n'
import { formatRelative } from '@/features/projects/suites/lib/format-relative'

const SOURCE_LABELS: Record<string, string> = {
  manual: 'runs.sourceManual',
  api: 'runs.sourceApi',
  github_actions: 'runs.sourceCi',
}

const SHORTCUT_KEYS: Array<{ key: string; labelKey: string }> = [
  { key: 'P', labelKey: 'runs.shortcutPass' },
  { key: 'F', labelKey: 'runs.shortcutFail' },
  { key: 'S', labelKey: 'runs.shortcutSkip' },
  { key: 'B', labelKey: 'runs.shortcutBlocked' },
  { key: 'R', labelKey: 'runs.shortcutRunNext' },
  { key: '←→', labelKey: 'runs.shortcutNavigate' },
]

const STATUS_LABEL_KEYS: Record<string, string> = {
  pass: 'runs.statusPass',
  fail: 'runs.statusFail',
  skip: 'runs.statusSkip',
  blocked: 'runs.statusBlocked',
  running: 'runs.statusRunning',
  pending: 'runs.statusPending',
}

export function RunDetail({
  projectId,
  run,
}: {
  projectId: string
  run: RunRecord
}) {
  const { t, locale } = useTranslation()
  const [announcement, setAnnouncement] = useState('')

  const handleUpdateError = useCallback(
    (error: unknown) => {
      const message =
        error instanceof ApiError && error.status === 409
          ? t('runs.updateCaseConflict')
          : t('runs.updateCaseError')
      setAnnouncement(message)
    },
    [t],
  )

  const updateStatus = useUpdateRunCase(run.id, handleUpdateError)
  const isEditable = run.source === 'manual'
  const { suite } = useSuite(isEditable ? run.suiteId : '')
  const automatedCoverage = useMemo(
    () => (suite ? suite.cases.filter((c) => c.executionMode === 'automated') : []),
    [suite],
  )

  const sortedCases = useMemo(() => run.cases, [run.cases])

  const [selectedId, setSelectedId] = useState<string>(sortedCases[0]?.id ?? '')

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
      const labelKey = STATUS_LABEL_KEYS[status]
      setAnnouncement(
        t('runs.statusAnnouncement', { status: labelKey ? t(labelKey) : status }),
      )
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
          {SHORTCUT_KEYS.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-default">
              <kbd className="font-mono text-xs font-semibold px-1.5 py-0.5 rounded border border-border bg-surface-hover text-default shadow-sm min-w-[20px] text-center">
                {s.key}
              </kbd>
              <span className="text-muted">{t(s.labelKey)}</span>
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

      {/* Read-only coverage from CI, for a manual run whose suite also has automated cases */}
      {isEditable && automatedCoverage.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-default">{t('runs.coveredByCi')}</h2>
          <div className="rounded-xl border border-border bg-surface shadow-card overflow-hidden divide-y divide-border">
            {automatedCoverage.map((tc) => {
              const described = describeCase(tc)
              return (
                <div key={tc.id} className="py-3 px-4 sm:px-5 flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-medium text-default truncate flex-1 min-w-[200px]">
                    {described.title}
                  </span>
                  {tc.lastResult ? (
                    <div className="flex items-center gap-2">
                      <StatusChip status={tc.lastResult.status} />
                      <span className="text-xs text-muted">
                        {formatRelative(tc.lastResult.recordedAt, locale, t('suites.never'))}
                      </span>
                      {tc.lastResult.commitSha && (
                        <Link
                          href={`/projects/${projectId}/runs/${tc.lastResult.runId}`}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {tc.lastResult.commitSha.slice(0, 7)}
                        </Link>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted">{t('suites.never')}</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
