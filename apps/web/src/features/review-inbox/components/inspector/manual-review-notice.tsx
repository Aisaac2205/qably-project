'use client'

import { Sparkle } from '@phosphor-icons/react'
import type { ExtractedProposal } from '@qably/types'
import { useDocumentCase } from '@/features/projects/suites/hooks/use-suite-mutations'
import { extractionFailureReasonKey } from '@/lib/extraction-failure-reason'
import { useTranslation } from '@/lib/i18n'

interface ManualReviewNoticeProps {
  proposal: ExtractedProposal
}

export function ManualReviewNotice({ proposal }: ManualReviewNoticeProps) {
  const { t } = useTranslation()
  const documentCase = useDocumentCase()
  const manualReviewReason = extractionFailureReasonKey(proposal.objective)
  const canRedocumentCase =
    manualReviewReason === 'manualReviewReasonExtractionIncomplete' &&
    proposal.targetOfficialTestCaseId !== undefined &&
    proposal.targetOfficialTestCaseSuiteId !== undefined

  return (
    <div className="space-y-1.5 rounded-xl border border-warn/40 bg-warn-bg/60 p-4">
      <h4 className="text-xs font-semibold text-warn">{t('reviewInbox.manualReviewTitle')}</h4>
      <p className="text-sm text-default leading-relaxed">
        {t(`reviewInbox.${manualReviewReason ?? 'manualReviewReasonUnknown'}`)}
      </p>
      <p className="text-xs text-muted leading-relaxed">{t('reviewInbox.manualReviewHint')}</p>
      {canRedocumentCase && (
        <button
          type="button"
          onClick={() =>
            documentCase.mutate({
              suiteId: proposal.targetOfficialTestCaseSuiteId as string,
              caseId: proposal.targetOfficialTestCaseId as string,
            })
          }
          disabled={documentCase.isPending}
          className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-ai hover:text-ai transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md py-1 px-2.5 bg-ai-bg/40 border border-dashed border-ai/40 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Sparkle size={13} weight="bold" aria-hidden="true" />
          {t('suites.redocumentCase')}
        </button>
      )}
    </div>
  )
}
