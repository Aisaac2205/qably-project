'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useProjectChat } from '../hooks/use-project-chat'
import { useAiProviders } from '../hooks/use-ai-providers'
import { ChatMessageList } from './chat-message-list'
import { ChatComposer } from './chat-composer'
import { buttonVariants } from '@/components/ui/button'
import { Robot } from '@phosphor-icons/react'
import type { AiProvider } from '@qably/types'

export function ProjectChatPanel({
  projectId,
  onViewCase,
  prefillPrompt,
}: {
  projectId: string
  onViewCase: (caseId: string) => void
  prefillPrompt?: string
}) {
  const { messages, send } = useProjectChat(projectId)
  const { providers, connectedProviders, hasConnected } = useAiProviders()
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>(
    connectedProviders[0]?.provider ?? 'claude',
  )

  if (!hasConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
        <Robot size={32} weight="light" className="text-muted" aria-hidden="true" />
        <p className="text-sm text-default">Connect an AI provider to start chatting</p>
        <p className="text-xs text-muted max-w-xs">
          Link Claude or Gemini in Settings to ask questions about this project and draft new test cases.
        </p>
        <Link href="/settings" className={buttonVariants({ size: 'sm' })}>
          Go to Settings
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0">
        <ChatMessageList messages={messages} projectId={projectId} onViewCase={onViewCase} />
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
