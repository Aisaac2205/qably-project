'use client'

import Link from 'next/link'
import { WarningCircle, ArrowSquareOut, FileText } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import { useQualityRisks, useProjects } from '@/lib/use-mock-store'
import { StateView } from '@/components/ui/state-view'

const SEVERITY_CONFIG: Record<
  string,
  {
    label: string
    colorClass: string
    badgeClass: string
  }
> = {
  critical: {
    label: 'Critical',
    colorClass: 'text-fail',
    badgeClass: 'bg-fail-bg text-fail border-fail-border',
  },
  high: {
    label: 'High',
    colorClass: 'text-warn',
    badgeClass: 'bg-warn-bg text-warn border-warn-border',
  },
  medium: {
    label: 'Medium',
    colorClass: 'text-running',
    badgeClass: 'bg-running-bg text-running border-running-border',
  },
  low: {
    label: 'Low',
    colorClass: 'text-muted',
    badgeClass: 'bg-canvas text-muted border-border',
  },
}

export function QualityRiskPanel() {
  const { t } = useTranslation()
  const risks = useQualityRisks()
  const projects = useProjects()
  const projectsMap = new Map(projects.map((p) => [p.id, p]))

  return (
    <section
      aria-labelledby="quality-risks-heading"
      className="rounded-xl border border-border bg-surface p-5 shadow-xs md:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="quality-risks-heading"
            className="text-base font-semibold tracking-[-0.015em] text-default"
          >
            {t('dashboard.qualityRisks')}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {t('dashboard.qualityRisksSubtitle')}
          </p>
        </div>
        {risks.length > 0 ? (
          <span className="inline-flex shrink-0 items-center rounded-md border border-border bg-canvas px-2.5 py-1 text-xs font-medium text-muted">
            {t('dashboard.activeSignalsCount', { count: risks.length })}
          </span>
        ) : null}
      </div>

      {risks.length === 0 ? (
        <StateView
          kind="empty"
          title={t('dashboard.qualityRisksEmptyTitle')}
          description={t('dashboard.qualityRisksEmptyDesc')}
          className="mt-2"
        />
      ) : (
        <div className="mt-4 divide-y divide-border/60">
          {risks.map((risk) => {
            const severity = SEVERITY_CONFIG[risk.severity] ?? SEVERITY_CONFIG.medium
            const project = projectsMap.get(risk.projectId)

            return (
              <div
                key={risk.id}
                className="group flex flex-col justify-between gap-3 py-3.5 first:pt-1 last:pb-0 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 items-start gap-3 flex-1">
                  <WarningCircle
                    size={18}
                    weight="fill"
                    aria-hidden="true"
                    className={`mt-0.5 shrink-0 ${severity.colorClass}`}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold border ${severity.badgeClass}`}>
                        {severity.label}
                      </span>
                      {project && (
                        <span className="inline-flex items-center rounded bg-canvas border border-border px-2 py-0.5 text-[11px] font-medium text-muted">
                          {project.name}
                        </span>
                      )}
                      {risk.evidenceIds.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                          <FileText size={12} aria-hidden="true" />
                          <span>{risk.evidenceIds.length} evidence</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-default">
                      {risk.criteria.join(' · ')}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 self-end sm:self-center">
                  <Link
                    href={`/projects/${risk.projectId}/repository`}
                    className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                  >
                    <span>View repository</span>
                    <ArrowSquareOut size={12} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
