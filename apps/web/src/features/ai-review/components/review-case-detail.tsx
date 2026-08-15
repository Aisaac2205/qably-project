'use client'

import type { AiCase } from '@qably/types'
import { Card, CardContent } from '@/components/ui/card'
import { CodeSnippet } from './code-snippet'
import { DuplicateComparison } from './duplicate-comparison'
import { useTranslation } from '@/lib/i18n'
import { useEvidence, useProposalForAiReviewCase, useTraceabilityLinks } from '@/lib/use-mock-store'
import { ProvenanceSummary } from '@/components/ui/provenance-summary'
import { EvidenceList } from '@/components/ui/evidence-list'
import { TraceabilityTrail } from '@/components/ui/traceability-trail'

export function ReviewCaseDetail({ c }: { c: AiCase }) {
  const { t } = useTranslation()
  const possibleDuplicateOf = c.possibleDuplicateOf ?? c.duplicateOfCaseId
  const proposal = useProposalForAiReviewCase(c.id)
  const evidence = useEvidence(proposal?.evidenceId)
  const links = useTraceabilityLinks(proposal?.id ?? '')
  
  return (
    <Card className="rounded-none border-0 h-full">
      <CardContent className="space-y-5 p-5">
        <h3 className="text-lg font-semibold text-default leading-snug">{c.name}</h3>

        {possibleDuplicateOf && c.similarityScore !== undefined && (
          <DuplicateComparison
            possibleDuplicateOf={possibleDuplicateOf}
            similarityScore={c.similarityScore}
            projectId={c.projectId}
          />
        )}

        <div>
          <h4 className="text-sm font-medium text-default mb-2">
            {t('aiReview.steps')}
          </h4>
          <ol className="space-y-2 list-decimal list-inside marker:text-muted marker:font-mono">
            {c.steps.map((step, i) => (
              <li key={i} className="text-sm text-default leading-relaxed pl-1">
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h4 className="text-sm font-medium text-default mb-2">
            {t('aiReview.expectedResult')}
          </h4>
          <p className="text-sm text-default bg-surface border border-border rounded p-3 leading-relaxed">
            {c.expectedResult}
          </p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-default mb-2">
            {t('aiReview.sourceSnippet')}
          </h4>
          <CodeSnippet code={c.sourceSnippet} language="TypeScript" />
        </div>

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
