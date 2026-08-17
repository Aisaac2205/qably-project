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
        <div className="group min-w-0 rounded-xl border border-border bg-surface p-4 shadow-xs transition-all duration-200 hover:border-border-strong hover:shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="flex shrink-0 items-center justify-center text-ai transition-colors duration-200">
              <Sparkle size={18} weight="fill" aria-hidden="true" />
            </span>
            <span className="inline-flex items-center rounded-md border border-border bg-canvas px-2 py-0.5 text-xs font-medium text-muted">
              {t('reviewInbox.kpiPendingSub')}
            </span>
          </div>
          <div className="mt-3.5 flex min-w-0 items-end justify-between gap-3">
            <div className="min-w-0">
              <dd className="text-2xl font-semibold tracking-[-0.025em] tabular-nums text-default">
                {pendingProposals.length}
              </dd>
              <dt className="mt-0.5 truncate text-xs font-medium text-muted">
                {t('reviewInbox.kpiPending')}
              </dt>
            </div>
            <div className="min-w-0 pb-0.5 text-right">
              <span className="block max-w-24 truncate text-[11px] text-muted">
                {t('common.acrossProjects', { count: projects.length })}
              </span>
            </div>
          </div>
        </div>

        {/* Approved & Published */}
        <div className="group min-w-0 rounded-xl border border-border bg-surface p-4 shadow-xs transition-all duration-200 hover:border-border-strong hover:shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="flex shrink-0 items-center justify-center text-pass transition-colors duration-200">
              <CheckCircle size={18} weight="fill" aria-hidden="true" />
            </span>
            <span className="inline-flex items-center rounded-md border border-border bg-canvas px-2 py-0.5 text-xs font-medium text-muted">
              {t('reviewInbox.kpiApprovedSub')}
            </span>
          </div>
          <div className="mt-3.5 flex min-w-0 items-end justify-between gap-3">
            <div className="min-w-0">
              <dd className="text-2xl font-semibold tracking-[-0.025em] tabular-nums text-default">
                {approvedProposals.length}
              </dd>
              <dt className="mt-0.5 truncate text-xs font-medium text-muted">
                {t('reviewInbox.kpiApproved')}
              </dt>
            </div>
            <div className="min-w-0 pb-0.5 text-right">
              <span className="block max-w-24 truncate text-[11px] text-pass font-medium">
                {approvedProposals.length > 0 ? t('common.versioned') : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Potential Duplicates */}
        <div className="group min-w-0 rounded-xl border border-border bg-surface p-4 shadow-xs transition-all duration-200 hover:border-border-strong hover:shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="flex shrink-0 items-center justify-center text-warn transition-colors duration-200">
              <CopySimple size={18} weight="bold" aria-hidden="true" />
            </span>
            <span className="inline-flex items-center rounded-md border border-border bg-canvas px-2 py-0.5 text-xs font-medium text-muted">
              {t('reviewInbox.kpiDuplicatesSub')}
            </span>
          </div>
          <div className="mt-3.5 flex min-w-0 items-end justify-between gap-3">
            <div className="min-w-0">
              <dd className="text-2xl font-semibold tracking-[-0.025em] tabular-nums text-default">
                {duplicateProposals.length}
              </dd>
              <dt className="mt-0.5 truncate text-xs font-medium text-muted">
                {t('reviewInbox.kpiDuplicates')}
              </dt>
            </div>
            <div className="min-w-0 pb-0.5 text-right">
              <span className="block max-w-24 truncate text-[11px] text-muted">
                {duplicateProposals.length > 0 ? t('aiReview.possibleDuplicate') : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Active Projects */}
        <div className="group min-w-0 rounded-xl border border-border bg-surface p-4 shadow-xs transition-all duration-200 hover:border-border-strong hover:shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="flex shrink-0 items-center justify-center text-muted transition-colors duration-200 group-hover:text-default">
              <Folders size={18} aria-hidden="true" />
            </span>
            <span className="inline-flex items-center rounded-md border border-border bg-canvas px-2 py-0.5 text-xs font-medium text-muted">
              {t('reviewInbox.kpiProjectsSub')}
            </span>
          </div>
          <div className="mt-3.5 flex min-w-0 items-end justify-between gap-3">
            <div className="min-w-0">
              <dd className="text-2xl font-semibold tracking-[-0.025em] tabular-nums text-default">
                {activeProjectsCount}
              </dd>
              <dt className="mt-0.5 truncate text-xs font-medium text-muted">
                {t('reviewInbox.kpiProjects')}
              </dt>
            </div>
            <div className="min-w-0 pb-0.5 text-right">
              <span className="block max-w-24 truncate text-[11px] text-muted">
                / {projects.length} {t('common.total')}
              </span>
            </div>
          </div>
        </div>
      </dl>
    </section>
  )
}
