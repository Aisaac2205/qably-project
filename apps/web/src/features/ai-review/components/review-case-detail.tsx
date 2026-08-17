'use client'

import type { ExtractedProposal } from '@qably/types'
import { Card, CardContent } from '@/components/ui/card'
import { CodeSnippet } from './code-snippet'
import { DuplicateComparison } from './duplicate-comparison'
import { useTranslation } from '@/lib/i18n'
import { useEvidence, useTraceabilityLinks } from '@/lib/use-mock-store'
import { ProvenanceSummary } from '@/components/ui/provenance-summary'
import { EvidenceList } from '@/components/ui/evidence-list'
import { TraceabilityTrail } from '@/components/ui/traceability-trail'

export function ReviewCaseDetail({ proposal }: { proposal: ExtractedProposal }) {
  const { t } = useTranslation()
  const evidence = useEvidence(proposal.evidenceId)
  const links = useTraceabilityLinks(proposal.id)

  return (
    <Card className="rounded-none border-0 h-full">
      <CardContent className="space-y-5 p-5">
        <h3 className="text-lg font-semibold text-default leading-snug">{proposal.title}</h3>

        {proposal.targetOfficialTestCaseId && (
          <DuplicateComparison targetOfficialTestCaseId={proposal.targetOfficialTestCaseId} />
        )}

        <div>
          <h4 className="text-sm font-medium text-default mb-2">
            {t('aiReview.steps')}
          </h4>
          <ol className="space-y-2 list-decimal list-inside marker:text-muted marker:font-mono">
            {proposal.steps.map((step, i) => (
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
            {proposal.expectedResult}
          </p>
        </div>

        <div>
          <h4 className="text-sm font-medium text-default mb-2">
            {t('aiReview.sourceSnippet')}
          </h4>
          <CodeSnippet code={evidence?.excerpt ?? ''} language="TypeScript" />
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
