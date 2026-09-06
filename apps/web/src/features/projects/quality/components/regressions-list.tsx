'use client'

import Link from 'next/link'
import type { RegressionEntry } from '@qably/types'
import { EntityList } from '@/components/ui/entity-list'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'

interface RegressionsListProps {
  projectId: string
  regressions: RegressionEntry[]
  runsScanned: number
}

function formatDetectedAt(iso: string, locale: 'en' | 'es'): string {
  try {
    return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function RegressionsList({ projectId, regressions, runsScanned }: RegressionsListProps) {
  const { t, locale } = useTranslation()

  if (regressions.length === 0) {
    return (
      <StateView
        kind="empty"
        title={t('quality.regressionsEmptyTitle')}
        description={
          runsScanned === 0
            ? t('quality.regressionsEmptyDescriptionNoRuns')
            : t('quality.regressionsEmptyDescription', { count: runsScanned })
        }
      />
    )
  }

  return (
    <EntityList
      aria-label={t('quality.regressionsListLabel')}
      className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card"
    >
      {regressions.map((regression) => (
        <li key={`${regression.runId}-${regression.testCaseId}`}>
          <Link
            href={`/projects/${projectId}/runs/${regression.runId}`}
            className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-hover/60 sm:px-5"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-default">{regression.caseName}</div>
              <div className="mt-0.5 truncate text-xs text-muted">
                {t('quality.regressionsDetectedIn', {
                  runName: regression.runName,
                  suiteName: regression.suiteName,
                })}
              </div>
            </div>
            <div className="shrink-0 text-xs text-muted">
              {formatDetectedAt(regression.detectedAt, locale === 'en' ? 'en' : 'es')}
            </div>
          </Link>
        </li>
      ))}
    </EntityList>
  )
}
