'use client'

import { useAiCases } from '@/lib/use-mock-store'
import { Button } from '@/components/ui/button'
import { Sparkle } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export function ChatGeneratedCaseCard({
  caseId,
  projectId,
  onView,
}: {
  caseId: string
  projectId: string
  onView: (caseId: string) => void
}) {
  const cases = useAiCases(projectId)
  const { t } = useTranslation()
  const generatedCase = cases.find((c) => c.id === caseId)
  if (!generatedCase) return null

  return (
    <div className="rounded border border-ai/30 bg-ai-bg p-2.5 mt-2 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ai">
        <Sparkle size={14} weight="fill" aria-hidden="true" />
        {t('aiReview.draftCaseCreated')}
      </div>
      <p className="text-xs font-medium text-default">{generatedCase.name}</p>
      <Button size="sm" variant="outline" onClick={() => onView(caseId)}>
        {t('aiReview.viewInReviewQueue')}
      </Button>
    </div>
  )
}
