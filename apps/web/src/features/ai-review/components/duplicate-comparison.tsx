'use client'

import { useOfficialTestCase, useTestCaseVersion } from '@/lib/use-mock-store'
import { CopySimple } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export function DuplicateComparison({
  targetOfficialTestCaseId,
}: {
  targetOfficialTestCaseId: string
}) {
  const { t } = useTranslation()
  const officialTestCase = useOfficialTestCase(targetOfficialTestCaseId)
  const version = useTestCaseVersion(officialTestCase?.currentVersionId)

  return (
    <div className="rounded border border-warn/30 bg-warn-bg p-3.5 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-warn">
        <CopySimple size={16} weight="bold" aria-hidden="true" />
        {t('aiReview.possibleDuplicate')}
      </div>
      {version ? (
        <div>
          <p className="text-sm font-medium text-default">{version.title}</p>
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
