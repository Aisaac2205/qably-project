'use client'

import type { AiCase } from '@qably/types'
import { Card, CardContent } from '@/components/ui/card'
import { CodeSnippet } from './code-snippet'
import { DuplicateComparison } from './duplicate-comparison'
import { useTranslation } from '@/lib/i18n'

export function ReviewCaseDetail({ c }: { c: AiCase }) {
  const { t } = useTranslation()
  
  return (
    <Card className="rounded-none border-0 h-full">
      <CardContent className="space-y-4 p-4">
        <h3 className="text-base font-medium text-default">{c.name}</h3>

        {c.duplicateOfCaseId && c.similarityScore !== undefined && (
          <DuplicateComparison
            duplicateOfCaseId={c.duplicateOfCaseId}
            similarityScore={c.similarityScore}
            projectId={c.projectId}
          />
        )}

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
            {t('aiReview.steps')}
          </h4>
          <ol className="space-y-1 list-decimal list-inside">
            {c.steps.map((step, i) => (
              <li key={i} className="text-xs text-default leading-relaxed">
                {step}
              </li>
            ))}
          </ol>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
            {t('aiReview.expectedResult')}
          </h4>
          <p className="text-xs text-default bg-surface border border-border rounded p-2 leading-relaxed">
            {c.expectedResult}
          </p>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-1.5">
            {t('aiReview.sourceSnippet')}
          </h4>
          <CodeSnippet code={c.sourceSnippet} language="TypeScript" />
        </div>
      </CardContent>
    </Card>
  )
}
