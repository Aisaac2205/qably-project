'use client'

import { useSuites } from '@/lib/use-mock-store'
import { Badge } from '@/components/ui/badge'
import { CopySimple } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export function DuplicateComparison({
  duplicateOfCaseId,
  similarityScore,
  projectId,
}: {
  duplicateOfCaseId: string
  similarityScore: number
  projectId: string
}) {
  const suites = useSuites(projectId)
  const { t } = useTranslation()
  const existingCase = suites.flatMap((s) => s.cases).find((c) => c.id === duplicateOfCaseId)

  return (
    <div className="rounded border border-warn/30 bg-warn-bg p-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-warn">
        <CopySimple size={14} weight="bold" aria-hidden="true" />
        {t('aiReview.possibleDuplicate')}
        <Badge variant="warn" className="ml-auto">
          {Math.round(similarityScore * 100)}%
        </Badge>
      </div>
      {existingCase ? (
        <div>
          <p className="text-xs font-medium text-default">{existingCase.name}</p>
          <p className="text-xs text-muted mt-0.5">
            {t('aiReview.duplicateDescription')}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted">
          {t('aiReview.duplicateNotFound')}
        </p>
      )}
    </div>
  )
}
