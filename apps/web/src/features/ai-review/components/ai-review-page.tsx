'use client'

import { useAiReview } from '@/features/ai-review/hooks/use-ai-review'
import { ReviewCaseList } from './review-case-list'
import { ReviewCaseDetail } from './review-case-detail'
import { ReviewToolbar } from './review-toolbar'

export function AiReviewPage({ projectId }: { projectId: string }) {
  const {
    cases,
    selectedCase,
    selectCase,
    confirmSelected,
    rejectSelected,
    skipSelected,
  } = useAiReview(projectId)

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border">
        <h1 className="text-2xl font-semibold tracking-tight text-default mb-6">AI Review</h1>
        <p className="text-[11px] text-muted">
          {cases.length} case{cases.length !== 1 ? 's' : ''} pending review
        </p>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-72 shrink-0 border-r border-border overflow-y-auto">
          <ReviewCaseList
            cases={cases}
            selectedId={selectedCase?.id}
            onSelect={selectCase}
          />
        </div>
        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <div className="flex-1">
            {selectedCase ? (
              <ReviewCaseDetail c={selectedCase} />
            ) : (
              <div className="flex items-center justify-center h-full text-[11px] text-muted p-4">
                Select a case to review
              </div>
            )}
          </div>
          <ReviewToolbar
            disabled={!selectedCase}
            onConfirm={confirmSelected}
            onReject={rejectSelected}
            onSkip={skipSelected}
          />
        </div>
      </div>
    </div>
  )
}
