'use client'

import { X } from '@phosphor-icons/react'
import type { AttachedCaseRecord } from '@qably/types'
import { useTranslation } from '@/lib/i18n'

export function ChatCaseChip({
  attachedCase,
  onRemove,
}: {
  attachedCase: AttachedCaseRecord
  onRemove?: (caseId: string) => void
}) {
  const { t } = useTranslation()

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-ai/30 bg-ai-bg px-2 py-1 text-xs font-medium text-ai">
      <span className="truncate">{attachedCase.name}</span>
      <span aria-hidden="true" className="text-ai/50">
        ·
      </span>
      <span className="shrink-0 truncate text-ai/80">{attachedCase.suiteName}</span>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(attachedCase.id)}
          aria-label={t('aiReview.chatRemoveCase', { name: attachedCase.name })}
          className="shrink-0 rounded-full p-0.5 text-ai/70 hover:text-ai hover:bg-ai/10 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ai/40"
        >
          <X size={11} weight="bold" aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
