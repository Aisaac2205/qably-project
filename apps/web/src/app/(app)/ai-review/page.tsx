'use client'

import { useState } from 'react'
import { ReviewCaseList } from '@/components/ai-review/review-case-list'
import { ReviewCaseDetail } from '@/components/ai-review/review-case-detail'
import { mockAiCases } from '@/lib/mock-data'
import type { ReviewStatus } from '@/lib/mock-data'

type ReviewAction = 'confirmed' | 'rejected' | 'edit'

export default function AiReviewPage() {
  const [cases, setCases] = useState(mockAiCases)
  const [activeId, setActiveId] = useState(
    mockAiCases.find(c => c.reviewStatus === 'pending')?.id ?? mockAiCases[0].id
  )

  const activeCase = cases.find(c => c.id === activeId) ?? cases[0]
  const pendingCount = cases.filter(c => c.reviewStatus === 'pending').length

  function handleAction(action: ReviewAction) {
    if (action === 'edit') return
    const newStatus: ReviewStatus = action
    setCases(prev =>
      prev.map(c => (c.id === activeId ? { ...c, reviewStatus: newStatus } : c))
    )
    const currentIdx = cases.findIndex(c => c.id === activeId)
    const next = cases.slice(currentIdx + 1).find(c => c.reviewStatus === 'pending')
    if (next) setActiveId(next.id)
  }

  return (
    <div className="flex h-full overflow-hidden">
      <ReviewCaseList cases={cases} activeId={activeId} onSelect={setActiveId} />
      <ReviewCaseDetail
        aiCase={activeCase}
        onAction={handleAction}
        pendingCount={pendingCount}
      />
    </div>
  )
}
