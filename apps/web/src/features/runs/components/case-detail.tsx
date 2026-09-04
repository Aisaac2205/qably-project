'use client'

import Link from 'next/link'
import type { RunCaseRecord } from '@qably/types'
import { ArrowSquareOut, GitCommit } from '@phosphor-icons/react'
import { StatusChip } from './status-chip'
import { useTranslation } from '@/lib/i18n'
import { useOfficialTestCase, useTestCaseVersion, useTraceabilityLinks } from '@/lib/use-mock-store'
import { TraceabilityTrail } from '@/components/ui/traceability-trail'

export function CaseDetail({
  c,
  projectId,
}: {
  c: RunCaseRecord
  projectId?: string
}) {
  const { t } = useTranslation()
  const officialCaseId = `case-${c.id}`
  const officialCase = useOfficialTestCase(officialCaseId)
  const currentVersionId = officialCase?.currentVersionId ?? `version-${c.id}-1`
  const version = useTestCaseVersion(currentVersionId)
  const links = useTraceabilityLinks(officialCaseId)

  return (
    <div className="space-y-5 p-5 sm:p-6">
      {/* Header with name, version snapshot, and status */}
      <div className="space-y-2 pb-4 border-b border-border">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="rounded bg-canvas border border-border px-2 py-0.5 font-mono text-xs font-semibold text-muted">
            {t('runs.versionSnapshot', { version: version?.version ?? 1 })}
          </span>
          {projectId && officialCase && (
            <Link
              href={`/projects/${projectId}/suites/${officialCase.suiteId}`}
              className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline ml-auto"
            >
              <span>{t('runs.viewInLibrary')}</span>
              <ArrowSquareOut size={12} aria-hidden="true" />
            </Link>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-base sm:text-lg font-semibold text-default">{c.name}</h3>
          <StatusChip status={c.status} />
        </div>
      </div>

      {c.steps.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted">
            {t('runs.steps')}
          </h4>
          <ol className="space-y-1.5 list-decimal list-inside text-xs sm:text-sm text-default leading-relaxed bg-canvas/40 border border-border/60 rounded-lg p-3 sm:p-4">
            {c.steps.map((step, i) => (
              <li key={i} className="pl-1">
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}

      {c.expectedResult !== '' && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted">
            {t('runs.expectedResult')}
          </h4>
          <p className="text-xs sm:text-sm text-default bg-canvas/40 border border-border/60 rounded-lg p-3 sm:p-4 leading-relaxed">
            {c.expectedResult}
          </p>
        </div>
      )}

      {c.steps.length === 0 && c.expectedResult === '' && (
        <div className="space-y-1 rounded-lg border border-dashed border-border bg-canvas/40 p-3 sm:p-4">
          <p className="text-xs font-semibold text-default">
            {t('runs.undocumentedCase')}
          </p>
          <p className="text-xs text-muted leading-relaxed">
            {t('runs.undocumentedCaseHint')}
          </p>
        </div>
      )}

      {/* Bidirectional Traceability Trail */}
      {links.length > 0 && (
        <div className="space-y-3 border-t border-border pt-5">
          <h4 className="text-xs font-semibold text-muted flex items-center gap-1.5">
            <GitCommit size={14} weight="bold" aria-hidden="true" />
            {t('runs.traceability')}
          </h4>
          <TraceabilityTrail links={links} />
        </div>
      )}
    </div>
  )
}
