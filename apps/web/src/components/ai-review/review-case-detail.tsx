import type { AiCase } from '@/lib/mock-data'
import { CodeSnippet } from './code-snippet'
import { Sparkle } from '@phosphor-icons/react'

type ReviewAction = 'confirmed' | 'rejected' | 'edit'

interface ReviewCaseDetailProps {
  aiCase: AiCase
  onAction: (action: ReviewAction) => void
  pendingCount?: number
}

export function ReviewCaseDetail({ aiCase, onAction, pendingCount }: ReviewCaseDetailProps) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-3 py-2 bg-surface border-b border-border">
        <div className="text-sm font-bold text-default mb-1">{aiCase.name}</div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-ai-bg text-ai">
            <Sparkle size={10} weight="fill" aria-hidden="true" />
            AI
          </span>
          <span className="text-[10px] text-muted font-mono">{aiCase.sourceFile}</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 py-2 space-y-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">Generated test case</div>
          <ol className="space-y-1 mb-2">
            {aiCase.steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-xs text-default">
                <span className="text-muted w-4 shrink-0">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted italic">→ {aiCase.expectedResult}</p>
        </div>

        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">Source in code</div>
          <CodeSnippet code={aiCase.sourceSnippet} />
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 bg-surface border-t border-border">
        <button
          aria-label="Confirm"
          onClick={() => onAction('confirmed')}
          className="px-2.5 py-1.5 rounded text-xs font-bold bg-pass-bg text-pass"
        >
          ✓ Confirm
        </button>
        <button
          aria-label="Edit"
          onClick={() => onAction('edit')}
          className="px-2.5 py-1.5 rounded text-xs font-semibold bg-canvas text-muted border border-border"
        >
          ✎ Edit
        </button>
        <button
          aria-label="Reject"
          onClick={() => onAction('rejected')}
          className="px-2.5 py-1.5 rounded text-xs font-bold bg-fail-bg text-fail"
        >
          ✗ Reject
        </button>
        {pendingCount !== undefined && (
          <span className="ml-auto text-[10px] text-muted">{pendingCount} pending</span>
        )}
      </div>
    </div>
  )
}
