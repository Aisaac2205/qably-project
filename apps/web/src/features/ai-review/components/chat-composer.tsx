'use client'

import { useState } from 'react'
import { AiPromptInput } from '@/features/ai-prompt'
import { ProviderPicker } from './provider-picker'
import { PaperPlaneRight } from '@phosphor-icons/react'
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

  const handleSend = (prompt: string) => {
    if (!prompt.trim()) return
    onSend(prompt.trim())
    setValue('')
  }

  return (
    <div className="bg-surface px-4 py-3 sm:px-6 sm:py-4">
      <div className="max-w-3xl mx-auto w-full">
        <div className="bg-surface border border-border rounded-2xl p-3 shadow-xs hover:border-border-strong focus-within:border-border-strong transition-colors">
          <AiPromptInput
            value={value}
            onChange={setValue}
            onSubmit={handleSend}
            placeholders={[t('aiReview.chatPlaceholder')]}
            showToolbar={false}
            showActions={false}
            showModelSelector={false}
            className="border-0 shadow-none p-0 bg-transparent"
            textareaClassName="min-h-[44px] text-sm"
          />
          <div className="mt-2 flex items-center justify-between pt-2 border-t border-border/40">
            <ProviderPicker
              providers={providers}
              selected={selectedProvider}
              onSelect={onSelectProvider}
            />
            <button
              type="button"
              onClick={() => handleSend(value)}
              disabled={!value.trim()}
              aria-label={t('aiReview.sendMessage')}
              className={cn(
                'size-8 rounded-lg flex items-center justify-center transition-all duration-150',
                value.trim()
                  ? 'bg-primary text-primary-fg hover:bg-primary-hover shadow-xs active:scale-95'
                  : 'bg-canvas text-muted/40 cursor-not-allowed'
              )}
            >
              <PaperPlaneRight size={16} weight="fill" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
