'use client'

import { useSuites } from '@/lib/use-mock-store'
import { Badge } from '@/components/ui/badge'
import { CopySimple } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export function DuplicateComparison({
  possibleDuplicateOf,
  similarityScore,
  projectId,
}: {
  possibleDuplicateOf: string
  similarityScore: number
  projectId: string
}) {
  const suites = useSuites(projectId)
  const { t } = useTranslation()
  const existingCase = suites.flatMap((s) => s.cases).find((c) => c.id === possibleDuplicateOf)

  return (
    <div className="rounded border border-warn/30 bg-warn-bg p-3.5 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-warn">
        <CopySimple size={16} weight="bold" aria-hidden="true" />
        {t('aiReview.possibleDuplicate')}
        <Badge variant="warn" className="ml-auto">
          {Math.round(similarityScore * 100)}%
        </Badge>
      </div>
      {existingCase ? (
        <div>
          <p className="text-sm font-medium text-default">{existingCase.name}</p>
          <p className="text-sm text-muted mt-1 leading-relaxed">
            {t('aiReview.duplicateDescription')}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted leading-relaxed">
          {t('aiReview.duplicateNotFound')}
        </p>
      )}
    </div>
  )
}
