'use client'

import type { AiCase } from '@qably/types'
import { CodeSnippet } from './code-snippet'

export function ReviewCaseDetail({ c }: { c: AiCase }) {
  return (
    <div className="space-y-4 p-4">
      <h3 className="text-sm font-semibold text-default">{c.name}</h3>

      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">
          Steps
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
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">
          Expected result
        </h4>
        <p className="text-xs text-default bg-surface border border-border rounded p-2 leading-relaxed">
          {c.expectedResult}
        </p>
      </div>

      <div>
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1.5">
          Source snippet
        </h4>
        <CodeSnippet code={c.sourceSnippet} language="TypeScript" />
      </div>
    </div>
  )
}
