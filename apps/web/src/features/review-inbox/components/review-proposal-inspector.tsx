'use client'

import Link from 'next/link'
import type { ExtractedProposal } from '@qably/types'
import {
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ShieldCheck,
  Target,
  ClipboardText,
  ListNumbers,
  Code,
  Paperclip,
  DotsThree,
  FileText,
  Clock,
  ChatsCircle,
  ChatCircleText,
} from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { CodeSnippet } from '@/features/ai-review/components/code-snippet'
import { DuplicateComparison } from '@/features/ai-review/components/duplicate-comparison'
import { EvidenceList } from '@/components/ui/evidence-list'
import { TraceabilityTrail } from '@/components/ui/traceability-trail'
import { useProject } from '@/features/projects/hooks/use-project'
import { useProposal } from '../hooks/use-proposals'
import { manualReviewReasonKey } from '../lib/manual-review-reason'
import { useTranslation } from '@/lib/i18n'
import { projectRootPath } from '@/features/projects/lib/routes'

interface ReviewProposalInspectorProps {
  proposal: ExtractedProposal
  onApprove: (id: string) => void
  onReject: (id: string) => void
  isSubmitting?: boolean
}

function getPriorityBadgeVariant(priority: ExtractedProposal['priority']): 'warn' | 'default' {
  switch (priority) {
    case 'critical':
    case 'high':
      return 'warn'
    case 'medium':
    case 'low':
    default:
      return 'default'
  }
}

export function ReviewProposalInspector({
  proposal,
  onApprove,
  onReject,
  isSubmitting = false,
}: ReviewProposalInspectorProps) {
  const { t } = useTranslation()
  const { project } = useProject(proposal.projectId)
  const { proposal: detail } = useProposal(proposal.id)
  const evidence = detail?.evidence ?? undefined
  const links = detail?.links ?? []

  const hasNothingToPublish = proposal.steps.length === 0
  const needsManualReview = proposal.needsManualReview || hasNothingToPublish
  const manualReviewReason = needsManualReview
    ? manualReviewReasonKey(proposal.objective)
    : null

  const isPending = proposal.status === 'in_review'
  const isApproved = proposal.status === 'approved'
  const isRejected = proposal.status === 'rejected'

  const formattedDate = proposal.createdAt
    ? new Date(proposal.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Sep 9, 01:23 PM'

  return (
    <div className="h-full flex flex-col justify-between overflow-hidden bg-surface">
      <div className="flex-1 overflow-y-auto space-y-6 p-6 sm:p-7 pb-10">
        {/* Header with Badges, Title, Options, and Metadata */}
        <div className="space-y-3 pb-5 border-b border-border/80">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={getPriorityBadgeVariant(proposal.priority)}
                className="text-xs font-semibold capitalize px-2.5 py-0.5 rounded-full"
              >
                {proposal.priority}
              </Badge>
              {project && (
                <Link
                  href={projectRootPath(project.id)}
                  className="inline-flex items-center rounded-full border border-border/80 bg-canvas/60 px-2.5 py-0.5 text-xs font-medium text-default transition-colors hover:border-border-strong hover:text-primary"
                >
                  {project.name}
                </Link>
              )}
              {isApproved && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-pass-bg text-pass">
                  <CheckCircle size={13} weight="fill" aria-hidden="true" />
                  {t('reviewInbox.decisionApproved')}
                </span>
              )}
              {isRejected && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-fail-bg text-fail">
                  <XCircle size={13} weight="fill" aria-hidden="true" />
                  {t('reviewInbox.decisionRejected')}
                </span>
              )}
            </div>

            <button
              type="button"
              aria-label="Opciones"
              className="rounded-lg p-1 text-muted hover:text-default hover:bg-canvas transition-colors"
            >
              <DotsThree size={20} weight="bold" aria-hidden="true" />
            </button>
          </div>

          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-default leading-snug">
            {proposal.title}
          </h3>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <ChatsCircle size={14} className="shrink-0 text-muted" aria-hidden="true" />
              <span>Chat</span>
            </span>

            {evidence?.title && (
              <span className="inline-flex items-center gap-1.5 font-mono">
                <FileText size={14} className="shrink-0 text-muted" aria-hidden="true" />
                <span className="text-default font-medium truncate max-w-xs">{evidence.title}</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} className="shrink-0 text-muted" aria-hidden="true" />
              <span>{formattedDate}</span>
            </span>

            <span className="inline-flex items-center gap-1.5">
              <ChatCircleText size={14} className="shrink-0 text-muted" aria-hidden="true" />
              <span>0</span>
            </span>
          </div>
        </div>

        {/* Duplicate Comparison if present */}
        {proposal.targetOfficialTestCaseId && (
          <DuplicateComparison targetOfficialTestCaseId={proposal.targetOfficialTestCaseId} />
        )}

        {/* Why this proposal cannot be published as it stands */}
        {needsManualReview && (
          <div className="space-y-1.5 rounded-xl border border-warn/40 bg-warn-bg/60 p-4">
            <h4 className="text-xs font-semibold text-warn">
              {t('reviewInbox.manualReviewTitle')}
            </h4>
            <p className="text-sm text-default leading-relaxed">
              {manualReviewReason === null
                ? t('reviewInbox.manualReviewReasonUnknown', {
                    reason: proposal.objective,
                  })
                : t(`reviewInbox.${manualReviewReason}`)}
            </p>
            <p className="text-xs text-muted leading-relaxed">
              {t('reviewInbox.manualReviewHint')}
            </p>
          </div>
        )}

        {/* Objective */}
        {!needsManualReview && proposal.objective && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
              <h4 className="text-xs sm:text-sm font-semibold text-default">
                {t('reviewInbox.objective')}
              </h4>
            </div>
            <p className="text-sm text-default/90 leading-relaxed pl-6">{proposal.objective}</p>
          </div>
        )}

        {/* Preconditions */}
        {proposal.preconditions && proposal.preconditions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ClipboardText size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
              <h4 className="text-xs sm:text-sm font-semibold text-default">
                {t('reviewInbox.preconditions')}
              </h4>
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-default/90 pl-6 leading-relaxed">
              {proposal.preconditions.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Steps */}
        {proposal.steps.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <ListNumbers size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
              <h4 className="text-xs sm:text-sm font-semibold text-default">
                {t('reviewInbox.steps')}
              </h4>
            </div>
            <ol className="space-y-2 pl-6">
              {proposal.steps.map((step, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-lg border border-border/70 bg-canvas/30 p-3 text-sm text-default leading-relaxed"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded bg-border/60 font-mono text-xs font-semibold text-muted">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Expected Result */}
        {proposal.expectedResult !== '' && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
              <h4 className="text-xs sm:text-sm font-semibold text-default">
                {t('reviewInbox.expectedResult')}
              </h4>
            </div>
            <div className="ml-6 rounded-xl border border-border/80 bg-canvas/40 p-4 text-sm text-default leading-relaxed">
              {proposal.expectedResult}
            </div>
          </div>
        )}

        {/* Source Code Snippet */}
        {evidence?.excerpt && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Code size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
              <h4 className="text-xs sm:text-sm font-semibold text-default">
                {t('reviewInbox.sourceSnippet')}
              </h4>
            </div>
            <div className="ml-6">
              <CodeSnippet code={evidence.excerpt} language="TypeScript" />
            </div>
          </div>
        )}

        {/* Evidence & Traceability */}
        {evidence && (
          <div className="space-y-3 border-t border-border/80 pt-6">
            <div className="flex items-center gap-2">
              <Paperclip size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
              <h4 className="text-xs sm:text-sm font-semibold text-default">
                {t('reviewInbox.evidenceHeading')}
              </h4>
            </div>
            <div className="ml-6 space-y-4">
              <EvidenceList evidence={[evidence]} />
              {links.length > 0 && <TraceabilityTrail links={links} />}
            </div>
          </div>
        )}
      </div>

      {/* Governed Action Toolbar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-surface px-6 py-4">
        {isPending ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isSubmitting || hasNothingToPublish}
              onClick={() => onApprove(proposal.id)}
              aria-label={t('reviewInbox.actionApprove')}
              title={
                hasNothingToPublish
                  ? t('reviewInbox.approveBlocked')
                  : undefined
              }
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs sm:text-sm font-semibold text-primary-fg shadow-2xs transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary"
            >
              <CheckCircle size={16} weight="fill" aria-hidden="true" />
              {t('reviewInbox.actionApprove')}
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onReject(proposal.id)}
              aria-label={t('reviewInbox.actionReject')}
              className="inline-flex items-center gap-2 rounded-full bg-surface border border-fail/40 px-5 py-2.5 text-xs sm:text-sm font-semibold text-fail transition-all duration-150 hover:bg-fail-bg/50 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-fail"
            >
              <XCircle size={16} weight="fill" aria-hidden="true" />
              {t('reviewInbox.actionReject')}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted">
            <ShieldCheck size={16} weight="fill" className={isApproved ? 'text-pass' : 'text-fail'} aria-hidden="true" />
            <span>
              {isApproved ? t('reviewInbox.approvedSuccess') : t('reviewInbox.rejectedSuccess')}
            </span>
          </div>
        )}

        {project && (
          <Link
            href={`/projects/${project.id}/ai-review`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition-colors hover:text-default group"
          >
            <span>{t('reviewInbox.actionProjectReview')}</span>
            <ArrowUpRight size={13} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
        )}
      </div>
    </div>
  )
}

