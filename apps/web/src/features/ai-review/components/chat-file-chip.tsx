'use client'

import { FileCode, X } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export function ChatFileChip({
  filePath,
  onRemove,
}: {
  filePath: string
  onRemove?: () => void
}) {
  const { t } = useTranslation()

  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-ai/30 bg-ai-bg px-2 py-1 text-xs font-medium text-ai">
      <FileCode size={12} aria-hidden="true" className="shrink-0" />
      <span className="truncate">{filePath}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('aiReview.chatRemoveFile', { path: filePath })}
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-ai/70 hover:text-ai hover:bg-ai/10 transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ai/40"
        >
          <X size={11} weight="bold" aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
