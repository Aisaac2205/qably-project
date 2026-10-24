'use client'

import { TestTube, X } from '@phosphor-icons/react'
import type { AttachedCaseRecord } from '@qably/types'
import { useTranslation } from '@/lib/i18n'

// Case and suite on their own lines, like a file attachment: suites are often
// named after a long test path, and one line cut both in the middle.
export function ChatCaseChip({
  attachedCase,
  onRemove,
}: {
  attachedCase: AttachedCaseRecord
  onRemove?: (caseId: string) => void
}) {
  const { t } = useTranslation()

  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-xl border border-border bg-surface py-1.5 pr-2 pl-1.5 text-xs">
      <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-ai-bg text-ai">
        <TestTube size={14} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col text-left">
        <span className="truncate font-medium text-default">{attachedCase.name}</span>
        <span className="truncate text-muted">{attachedCase.suiteName}</span>
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(attachedCase.id)}
          aria-label={t('aiReview.chatRemoveCase', { name: attachedCase.name })}
          className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-canvas-hover hover:text-default focus-visible:outline-2 focus-visible:outline-primary"
        >
          <X size={11} weight="bold" aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
