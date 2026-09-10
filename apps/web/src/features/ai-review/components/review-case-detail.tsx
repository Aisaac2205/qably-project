'use client'

import {
  Target,
  ClipboardText,
  ListNumbers,
  CheckCircle,
  Code,
  Paperclip,
  DotsThree,
  FileText,
  Clock,
  ChatsCircle,
  ChatCircleText,
  Plus,
} from '@phosphor-icons/react'
import type { ProposalListItem } from '@/features/review-inbox/api/review.api'
import { useProposal } from '@/features/review-inbox/hooks/use-proposals'
import { useProject } from '@/features/projects/hooks/use-project'
import { Badge } from '@/components/ui/badge'
import { CodeSnippet } from './code-snippet'
import { DuplicateComparison } from './duplicate-comparison'
import { ProvenanceSummary } from '@/components/ui/provenance-summary'
import { EvidenceList } from '@/components/ui/evidence-list'
import { TraceabilityTrail } from '@/components/ui/traceability-trail'
import { useTranslation } from '@/lib/i18n'
import { AerisObservations } from '@/components/ui/aeris-observations'

function getPriorityBadgeVariant(priority: ProposalListItem['priority']): 'warn' | 'default' {
  if (priority === 'critical' || priority === 'high') {
    return 'warn'
  }
  return 'default'
}

export function ReviewCaseDetail({ proposal }: { proposal: ProposalListItem }) {
  const { t } = useTranslation()
  const { project } = useProject(proposal.projectId)
  const { proposal: detail } = useProposal(proposal.id)
  const evidence = detail?.evidence ?? undefined
  const links = detail?.links ?? []

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
              {project?.name && (
                <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-canvas/60 px-2.5 py-0.5 text-xs font-medium text-muted">
                  <Plus size={11} aria-hidden="true" />
                  {project.name}
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

        {proposal.targetOfficialTestCaseId && (
          <DuplicateComparison proposalId={proposal.id} />
        )}

        {/* Section 1: Objetivo */}
        {proposal.objective && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Target size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
              <h4 className="text-xs sm:text-sm font-semibold text-default">
                {t('aiReview.objective')}
              </h4>
            </div>
            <p className="text-sm text-default/90 leading-relaxed pl-6">{proposal.objective}</p>
          </div>
        )}

        {/* Section 2: Precondiciones */}
        {proposal.preconditions && proposal.preconditions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ClipboardText size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
              <h4 className="text-xs sm:text-sm font-semibold text-default">
                {t('aiReview.preconditions')}
              </h4>
            </div>
            <ul className="list-disc list-inside space-y-1 text-sm text-default/90 pl-6 leading-relaxed">
              {proposal.preconditions.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Section 3: Pasos */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <ListNumbers size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
            <h4 className="text-xs sm:text-sm font-semibold text-default">
              {t('aiReview.steps')}
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

        {/* Section 4: Resultado esperado */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
            <h4 className="text-xs sm:text-sm font-semibold text-default">
              {t('aiReview.expectedResult')}
            </h4>
          </div>
          <div className="ml-6 rounded-xl border border-border/80 bg-canvas/40 p-4 text-sm text-default leading-relaxed">
            {proposal.expectedResult}
          </div>
        </div>

        <AerisObservations observations={proposal.observations} />

        {/* Section 5: Fragmento de origen */}
        {evidence?.excerpt && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Code size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
              <h4 className="text-xs sm:text-sm font-semibold text-default">
                {t('aiReview.sourceSnippet')}
              </h4>
            </div>
            <div className="ml-6">
              <CodeSnippet code={evidence.excerpt} language="TypeScript" />
            </div>
          </div>
        )}

        {/* Section 6: Evidencia y procedencia */}
        {evidence && (
          <div className="space-y-3 border-t border-border/80 pt-6">
            <div className="flex items-center gap-2">
              <Paperclip size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
              <h4 className="text-xs sm:text-sm font-semibold text-default">
                {t('reviewInbox.evidenceHeading')}
              </h4>
            </div>
            <div className="ml-6 space-y-4">
              <ProvenanceSummary evidence={evidence} />
              <EvidenceList evidence={[evidence]} />
              {links.length > 0 && <TraceabilityTrail links={links} />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

