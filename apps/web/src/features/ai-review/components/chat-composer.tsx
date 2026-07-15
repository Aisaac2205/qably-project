'use client'

import { useState, useEffect } from 'react'
import { PaperPlaneTilt } from '@phosphor-icons/react'
import { Textarea } from '@/components/ui/textarea'
import { ProviderPicker } from './provider-picker'
import { useAutoResizeTextarea } from '../hooks/use-auto-resize-textarea'
import { cn } from '@/lib/utils'
import type { AiProvider, AiProviderConnection } from '@qably/types'
import { useTranslation } from '@/lib/i18n'

export function ChatComposer({
  providers,
  selectedProvider,
  onSelectProvider,
  onSend,
  initialValue = '',
}: {
  providers: AiProviderConnection[]
  selectedProvider: AiProvider
  onSelectProvider: (provider: AiProvider) => void
  onSend: (text: string) => void
  initialValue?: string
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState(initialValue)
  const [prevInitialValue, setPrevInitialValue] = useState(initialValue)
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 44, maxHeight: 200 })

  if (initialValue !== prevInitialValue) {
    setPrevInitialValue(initialValue)
    setValue(initialValue)
  }

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  const handleSend = () => {
    if (!value.trim()) return
    onSend(value.trim())
    setValue('')
    adjustHeight(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border bg-surface p-2">
      <Textarea
        ref={textareaRef}
        value={value}
        placeholder={t('aiReview.chatPlaceholder')}
        className="border-0 bg-transparent focus-visible:ring-0 min-h-[44px]"
        onKeyDown={handleKeyDown}
        onChange={(e) => {
          setValue(e.target.value)
          adjustHeight()
        }}
      />
      <div className="flex items-center justify-between px-1 pt-1">
        <ProviderPicker providers={providers} selected={selectedProvider} onSelect={onSelectProvider} />
        <button
          type="button"
          onClick={handleSend}
          disabled={!value.trim()}
          aria-label={t('aiReview.sendMessage')}
          className={cn(
            'inline-flex items-center justify-center size-7 rounded-md transition-colors',
            'text-primary-fg bg-primary hover:bg-primary-hover',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          <PaperPlaneTilt size={14} weight="fill" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
