import Link from 'next/link'
import type { TestCase } from '@qably/types'
import { Clock, PencilSimple } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import type { CaseDocumentationBadge } from '@/features/projects/suites/lib/case-documentation-state'
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
