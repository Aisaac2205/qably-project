'use client'

import { useState, type KeyboardEvent } from 'react'
import { PaperPlaneRight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useAutoResizeTextarea } from '@/features/projects/test-generation/hooks/use-auto-resize-textarea'
import { useTranslation } from '@/lib/i18n'

const MIN_HEIGHT = 44
const MAX_HEIGHT = 200
const MAX_MESSAGE_LENGTH = 4000

export function ChatComposer({
  onSend,
  disabled = false,
  initialValue = '',
}: {
  onSend: (text: string) => void
  disabled?: boolean
  initialValue?: string
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState(initialValue)
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: MIN_HEIGHT,
    maxHeight: MAX_HEIGHT,
  })

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    adjustHeight(true)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="bg-surface px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-4 sm:pb-4">
      <div className="max-w-3xl mx-auto w-full">
        <div className="flex items-end gap-2 bg-surface border border-border rounded-2xl p-3 shadow-xs hover:border-border-strong focus-within:border-border-strong transition-colors">
          <label htmlFor="chat-composer-input" className="sr-only">
            {t('aiReview.chatComposerLabel')}
          </label>
          <textarea
            id="chat-composer-input"
            ref={textareaRef}
            value={value}
            disabled={disabled}
            onChange={(event) => {
              setValue(event.target.value)
              adjustHeight()
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('aiReview.chatPlaceholder')}
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            className="flex-1 resize-none bg-transparent text-sm text-default placeholder:text-muted outline-none disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            aria-label={t('aiReview.sendMessage')}
            className={cn(
              'size-8 shrink-0 rounded-lg flex items-center justify-center transition-all duration-150',
              value.trim() && !disabled
                ? 'bg-primary text-primary-fg hover:bg-primary-hover shadow-xs active:scale-95'
                : 'bg-canvas text-muted/40 cursor-not-allowed',
            )}
          >
            <PaperPlaneRight size={16} weight="fill" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
