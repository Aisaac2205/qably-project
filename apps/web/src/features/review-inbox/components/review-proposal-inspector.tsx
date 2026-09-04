'use client'

import Link from 'next/link'
import type { ExtractedProposal } from '@qably/types'
import {
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ShieldCheck,
} from '@phosphor-icons/react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CodeSnippet } from '@/features/ai-review/components/code-snippet'
import { DuplicateComparison } from '@/features/ai-review/components/duplicate-comparison'
import { EvidenceList } from '@/components/ui/evidence-list'
import { TraceabilityTrail } from '@/components/ui/traceability-trail'
import { useProject } from '@/features/projects/hooks/use-project'
import { useProposal } from '../hooks/use-proposals'
import { useTranslation } from '@/lib/i18n'

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

  const isPending = proposal.status === 'in_review'
  const isApproved = proposal.status === 'approved'
  const isRejected = proposal.status === 'rejected'

  return (
    <Card className="rounded-none border-0 h-full flex flex-col justify-between overflow-hidden bg-surface">
      <CardContent className="flex-1 overflow-y-auto space-y-6 p-5 sm:p-6">
        {/* Header with Title and Metadata */}
        <div className="space-y-2 pb-4 border-b border-border">
          <div className="flex flex-wrap items-center gap-2">
            {project && (
              <Link
                href={`/projects/${project.id}`}
                className="inline-flex items-center rounded-md border border-border bg-canvas px-2 py-0.5 text-xs font-medium text-default transition-colors hover:border-border-strong hover:text-primary"
              >
                {project.name}
              </Link>
            )}
            <Badge
              variant={getPriorityBadgeVariant(proposal.priority)}
              className="text-xs font-medium capitalize"
            >
              {proposal.priority}
            </Badge>
            {isApproved && (
              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-pass-bg text-pass">
                <CheckCircle size={13} weight="fill" aria-hidden="true" />
                {t('reviewInbox.decisionApproved')}
              </span>
            )}
            {isRejected && (
              <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold bg-fail-bg text-fail">
                <XCircle size={13} weight="fill" aria-hidden="true" />
                {t('reviewInbox.decisionRejected')}
              </span>
            )}
          </div>

          <h3 className="text-xl font-semibold tracking-tight text-default leading-snug">
            {proposal.title}
          </h3>

          {evidence?.title && (
            <p className="font-mono text-xs text-muted flex items-center gap-1.5">
              <span>{t('reviewInbox.sourceFile')}:</span>
              <span className="text-default font-medium">{evidence.title}</span>
            </p>
          )}
        </div>

        {/* Duplicate Comparison if present */}
        {proposal.targetOfficialTestCaseId && (
          <DuplicateComparison targetOfficialTestCaseId={proposal.targetOfficialTestCaseId} />
        )}

        {/* Objective */}
        {proposal.objective && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-muted">
              {t('reviewInbox.objective')}
            </h4>
            <p className="text-sm text-default leading-relaxed">{proposal.objective}</p>
          </div>
        )}

        {/* Preconditions */}
        {proposal.preconditions && proposal.preconditions.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-muted">
              {t('reviewInbox.preconditions')}
            </h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-default">
              {proposal.preconditions.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Steps */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted">
            {t('reviewInbox.steps')}
          </h4>
          <ol className="space-y-2">
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

        {/* Expected Result */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted">
            {t('reviewInbox.expectedResult')}
          </h4>
          <div className="rounded-lg border border-border bg-canvas/50 p-3.5 text-sm text-default leading-relaxed">
            {proposal.expectedResult}
          </div>
        </div>

        {/* Source Code Snippet */}
        {evidence?.excerpt && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted">
              {t('reviewInbox.sourceSnippet')}
            </h4>
            <CodeSnippet code={evidence.excerpt} language="TypeScript" />
          </div>
        )}

        {/* Evidence & Traceability */}
        {evidence && (
          <div className="space-y-4 border-t border-border pt-5">
            <h4 className="text-xs font-semibold text-muted">
              {t('reviewInbox.evidenceHeading')}
            </h4>
            <EvidenceList evidence={[evidence]} />
            {links.length > 0 && <TraceabilityTrail links={links} />}
          </div>
        )}
      </CardContent>

      {/* Governed Action Toolbar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface p-4 sm:px-6">
        {isPending ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onApprove(proposal.id)}
              aria-label={t('reviewInbox.actionApprove')}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs sm:text-sm font-semibold text-primary-fg shadow-xs transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary"
            >
              <CheckCircle size={16} weight="fill" aria-hidden="true" />
              {t('reviewInbox.actionApprove')}
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => onReject(proposal.id)}
              aria-label={t('reviewInbox.actionReject')}
              className="inline-flex items-center gap-2 rounded-lg bg-fail-bg px-4 py-2 text-xs sm:text-sm font-semibold text-fail transition-all duration-150 hover:bg-fail-bg/80 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-fail"
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
    </Card>
  )
}
