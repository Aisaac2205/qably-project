import Link from 'next/link'
import type { TestCase } from '@qably/types'
import { Clock, PencilSimple, Sparkle } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import { extractionFailureReasonKey } from '@/lib/extraction-failure-reason'
import type { CaseDocumentationBadge } from '@/features/projects/suites/lib/case-documentation-state'
import { useDocumentCase } from '@/features/projects/suites/hooks/use-suite-mutations'
import { CaseDisclosureToggle } from './case-disclosure'

export interface CaseDocumentationActionProps {
  testCase: TestCase
  stepsOpen: boolean
  onToggleSteps: () => void
  documentationBadge: CaseDocumentationBadge | null
  onEdit: (testCase: TestCase) => void
}

export function CaseDocumentationAction({
  testCase,
  stepsOpen,
  onToggleSteps,
  documentationBadge,
  onEdit,
}: CaseDocumentationActionProps) {
  const { t } = useTranslation()
  const documentCase = useDocumentCase()

  if (testCase.steps.length > 0) {
    return (
      <CaseDisclosureToggle
        label={t('suites.stepsCount', { count: testCase.steps.length })}
        isOpen={stepsOpen}
        onToggle={onToggleSteps}
      />
    )
  }

  if (testCase.executionMode === 'automated') {
    if (documentationBadge === null && testCase.pendingProposalId) {
      return (
        <Link
          href={`/review-inbox?proposal=${testCase.pendingProposalId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ai hover:text-ai transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md py-1 px-2.5 bg-ai-bg/40 border border-dashed border-ai/40"
        >
          <Clock size={13} weight="bold" aria-hidden="true" />
          {t('suites.caseInReview')}
        </Link>
      )
    }

    if (testCase.documentation?.outcome === 'failed') {
      const reasonCode = testCase.documentation.skipReason
      const reasonKey = reasonCode === null ? null : extractionFailureReasonKey(reasonCode)
      const reasonText =
        reasonCode === null
          ? null
          : t(`reviewInbox.${reasonKey ?? 'manualReviewReasonUnknown'}`)

      return (
        <div className="inline-flex flex-wrap items-center gap-1.5">
          <button
            onClick={() =>
              documentCase.mutate({ suiteId: testCase.suiteId, caseId: testCase.id })
            }
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ai hover:text-ai transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md py-1 px-2.5 bg-ai-bg/40 border border-dashed border-ai/40 cursor-pointer"
            type="button"
          >
            <Sparkle size={13} weight="bold" aria-hidden="true" />
            {t('suites.redocumentCase')}
          </button>
          {reasonText && (
            <span className="text-xs text-fail">
              {t('suites.documentationFailure.label', { reason: reasonText })}
            </span>
          )}
        </div>
      )
    }

    return null
  }

  return (
    <button
      onClick={() => onEdit(testCase)}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-primary transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md py-1 px-2.5 bg-canvas/40 border border-dashed border-border cursor-pointer"
      type="button"
    >
      <PencilSimple size={13} weight="bold" aria-hidden="true" />
      {t('suites.documentCase')}
    </button>
  )
}
