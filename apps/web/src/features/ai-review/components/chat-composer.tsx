'use client'

import { useState } from 'react'
import { AiPromptInput } from '@/features/ai-prompt'
import { ProviderPicker } from './provider-picker'
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
    <div className="border-t border-border bg-surface p-3 sm:p-4 space-y-2">
      <ProviderPicker
        providers={providers}
        selected={selectedProvider}
        onSelect={onSelectProvider}
      />
      <AiPromptInput
        value={value}
        onChange={setValue}
        onSubmit={handleSend}
        placeholders={[
          t('aiReview.chatPlaceholder'),
          'Ask about this project or request a new test case…',
          'Genera casos de prueba para el flujo de checkout…',
          '¿Qué cobertura falta en el módulo de pagos?',
        ]}
        showModelSelector={false}
        showActions
        textareaClassName="min-h-[44px]"
      />
    </div>
  )
}
