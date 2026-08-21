'use client'

import { Sparkle, CheckCircle, CopySimple, Folders } from '@phosphor-icons/react'
import { useProposals, useProjects } from '@/lib/use-mock-store'
import { useTranslation } from '@/lib/i18n'

export function ReviewKpiRow() {
  const proposals = useProposals()
  const projects = useProjects()
  const { t } = useTranslation()

  const pendingProposals = proposals.filter((p) => p.status === 'in_review')
  const approvedProposals = proposals.filter((p) => p.status === 'approved')
  const duplicateProposals = proposals.filter((p) => Boolean(p.targetOfficialTestCaseId))

  const pendingProjectIds = new Set(pendingProposals.map((p) => p.projectId))
  const activeProjectsCount = pendingProjectIds.size

  return (
    <section aria-label={t('reviewInbox.queueTitle')} className="min-w-0">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Pending Review */}
        <div className="group min-w-0 rounded-xl border border-border bg-surface p-4 shadow-xs transition-all duration-150 hover:border-border-strong">
          <div className="flex items-center justify-between">
            <dt className="text-xs font-medium text-muted">
              {t('reviewInbox.kpiPending')}
            </dt>
            <span className="flex shrink-0 items-center justify-center text-ai" aria-hidden="true">
              <Sparkle size={16} weight="fill" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <dd className="text-2xl font-semibold tracking-[-0.025em] tabular-nums text-default">
              {pendingProposals.length}
            </dd>
            <span className="text-[11px] text-muted truncate">
              {t('common.acrossProjects', { count: projects.length })}
            </span>
          </div>
        </div>

        {/* Approved & Published */}
        <div className="group min-w-0 rounded-xl border border-border bg-surface p-4 shadow-xs transition-all duration-150 hover:border-border-strong">
          <div className="flex items-center justify-between">
            <dt className="text-xs font-medium text-muted">
              {t('reviewInbox.kpiApproved')}
            </dt>
            <span className="flex shrink-0 items-center justify-center text-pass" aria-hidden="true">
              <CheckCircle size={16} weight="fill" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <dd className="text-2xl font-semibold tracking-[-0.025em] tabular-nums text-default">
              {approvedProposals.length}
            </dd>
            <span className="text-[11px] font-medium text-pass truncate">
              {approvedProposals.length > 0 ? t('common.versioned') : ''}
            </span>
          </div>
        </div>

        {/* Potential Duplicates */}
        <div className="group min-w-0 rounded-xl border border-border bg-surface p-4 shadow-xs transition-all duration-150 hover:border-border-strong">
          <div className="flex items-center justify-between">
            <dt className="text-xs font-medium text-muted">
              {t('reviewInbox.kpiDuplicates')}
            </dt>
            <span className="flex shrink-0 items-center justify-center text-warn" aria-hidden="true">
              <CopySimple size={16} weight="bold" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <dd className="text-2xl font-semibold tracking-[-0.025em] tabular-nums text-default">
              {duplicateProposals.length}
            </dd>
            <span className="text-[11px] text-warn truncate">
              {duplicateProposals.length > 0 ? t('reviewInbox.possibleDuplicate') : ''}
            </span>
          </div>
        </div>

        {/* Active Projects */}
        <div className="group min-w-0 rounded-xl border border-border bg-surface p-4 shadow-xs transition-all duration-150 hover:border-border-strong">
          <div className="flex items-center justify-between">
            <dt className="text-xs font-medium text-muted">
              {t('reviewInbox.kpiProjects')}
            </dt>
            <span className="flex shrink-0 items-center justify-center text-muted group-hover:text-default" aria-hidden="true">
              <Folders size={16} />
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <dd className="text-2xl font-semibold tracking-[-0.025em] tabular-nums text-default">
              {activeProjectsCount}
            </dd>
            <span className="text-[11px] text-muted truncate">
              / {projects.length} {t('common.total')}
            </span>
          </div>
        </div>
      </dl>
    </section>
  )
}
