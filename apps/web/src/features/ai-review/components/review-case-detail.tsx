'use client'

import type { ExtractedProposal } from '@qably/types'
import { Sparkle } from '@phosphor-icons/react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CodeSnippet } from './code-snippet'
import { DuplicateComparison } from './duplicate-comparison'
import { ProvenanceSummary } from '@/components/ui/provenance-summary'
import { EvidenceList } from '@/components/ui/evidence-list'
import { TraceabilityTrail } from '@/components/ui/traceability-trail'
import { useTranslation } from '@/lib/i18n'
import { useEvidence, useTraceabilityLinks } from '@/lib/use-mock-store'

function getPriorityBadgeVariant(priority: ExtractedProposal['priority']): 'warn' | 'default' {
  if (priority === 'critical' || priority === 'high') {
    return 'warn'
  }
  return 'default'
}

export function ReviewCaseDetail({ proposal }: { proposal: ExtractedProposal }) {
  const { t } = useTranslation()
  const evidence = useEvidence(proposal.evidenceId)
  const links = useTraceabilityLinks(proposal.id)

  return (
    <Card className="rounded-none border-0 h-full flex flex-col justify-between overflow-hidden bg-surface">
      <CardContent className="flex-1 overflow-y-auto space-y-5 p-5 sm:p-6 pb-8">
        {/* Proposal Heading & Source Metadata */}
        <div className="space-y-3 pb-4 border-b border-border">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-ai-bg px-2 py-0.5 text-xs font-semibold text-ai">
              <Sparkle size={12} weight="fill" aria-hidden="true" />
              {t('reviewInbox.inspectorSubtitle')}
            </span>
            <Badge
              variant={getPriorityBadgeVariant(proposal.priority)}
              className="text-xs font-medium capitalize"
            >
              {proposal.priority}
            </Badge>
          </div>

          <h3 className="text-lg sm:text-xl font-semibold tracking-tight text-default leading-snug">
            {proposal.title}
          </h3>

          {evidence?.title && (
            <p className="font-mono text-xs text-muted flex items-center gap-1.5">
              <span>{t('aiReview.sourceFile')}:</span>
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
              {t('aiReview.objective')}
            </h4>
            <p className="text-sm text-default leading-relaxed">{proposal.objective}</p>
          </div>
        )}

        {/* Preconditions */}
        {proposal.preconditions && proposal.preconditions.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-muted">
              {t('aiReview.preconditions')}
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
            {t('aiReview.steps')}
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
            {t('aiReview.expectedResult')}
          </h4>
          <div className="rounded-lg border border-border bg-canvas/50 p-3.5 text-sm text-default leading-relaxed">
            {proposal.expectedResult}
          </div>
        </div>

        {/* Source Code Snippet */}
        {evidence?.excerpt && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted">
              {t('aiReview.sourceSnippet')}
            </h4>
            <CodeSnippet code={evidence.excerpt} language="TypeScript" />
          </div>
        )}

        {/* Evidence & Traceability */}
        {evidence && (
          <div className="space-y-5 border-t border-border pt-5">
            <ProvenanceSummary evidence={evidence} />
            <EvidenceList evidence={[evidence]} />
            {links.length > 0 && <TraceabilityTrail links={links} />}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
