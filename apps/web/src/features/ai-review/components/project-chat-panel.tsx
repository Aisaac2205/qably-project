'use client'

import { useEffect, useRef, useState } from 'react'
import { useProjectChat } from '@/features/projects/test-generation/hooks/use-project-chat'
import { useAiProviders } from '@/features/projects/test-generation/hooks/use-ai-providers'
import { ChatMessageList } from './chat-message-list'
import { ChatComposer } from './chat-composer'
import { Button } from '@/components/ui/button'
import { StateView } from '@/components/ui/state-view'
import type { AiProvider } from '@qably/types'
import { useTranslation } from '@/lib/i18n'

export function ProjectChatPanel({
  projectId,
  onViewCase,
  onReturnToReview,
  prefillPrompt,
}: {
  projectId: string
  onViewCase: (caseId: string) => void
  onReturnToReview: () => void
  prefillPrompt?: string
}) {
  const { messages, send } = useProjectChat(projectId)
  const { providers, connectedProviders, hasConnected } = useAiProviders()
  const { t } = useTranslation()
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>(
    connectedProviders[0]?.provider ?? 'claude',
  )
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  if (!hasConnected) {
    return (
      <StateView
        kind="blocked"
        title={t('aiReview.connectProviderTitle')}
        description={t('aiReview.connectProviderDesc')}
        className="h-full"
        action={<Button size="sm" onClick={onReturnToReview}>{t('aiReview.returnToReview')}</Button>}
      />
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
        <ChatMessageList messages={messages} onViewCase={onViewCase} />
      </div>
      <ChatComposer
        providers={providers}
        selectedProvider={selectedProvider}
        onSelectProvider={setSelectedProvider}
        onSend={send}
        initialValue={prefillPrompt}
      />
    </div>
  )
}
