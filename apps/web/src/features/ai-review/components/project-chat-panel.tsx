'use client'

import { useEffect, useRef, useState } from 'react'
import { useProjectChat } from '@/features/projects/test-generation/hooks/use-project-chat'
import { useAiProviders } from '@/features/projects/test-generation/hooks/use-ai-providers'
import { ChatMessageList } from './chat-message-list'
import { ChatComposer } from './chat-composer'
import { ChatThreadSidebar } from './chat-thread-sidebar'
import { Button } from '@/components/ui/button'
import { StateView } from '@/components/ui/state-view'
import type { AiProvider } from '@qably/types'
import { useTranslation } from '@/lib/i18n'

const CHAT_SIDEBAR_STORAGE_KEY = 'qably:project-chat-sidebar-collapsed'

function getInitialSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(CHAT_SIDEBAR_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

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
  const {
    threads,
    activeThreadId,
    messages,
    allMessages,
    startNewChat,
    selectThread,
    removeThread,
    send,
  } = useProjectChat(projectId)
  const { providers, connectedProviders, hasConnected } = useAiProviders()
  const { t } = useTranslation()
  const [selectedProvider, setSelectedProvider] = useState<AiProvider>(
    connectedProviders[0]?.provider ?? 'claude',
  )
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getInitialSidebarCollapsed)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(CHAT_SIDEBAR_STORAGE_KEY, String(next))
      } catch {
        // Ignore storage errors in private browsing/sandboxes
      }
      return next
    })
  }

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
    <div className="flex h-full min-h-0">
      <ChatThreadSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={selectThread}
        onNewChat={startNewChat}
        onDeleteThread={removeThread}
        messages={allMessages}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />
      <div className="flex flex-col flex-1 min-w-0 h-full min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
          <ChatMessageList
            messages={messages}
            onViewCase={onViewCase}
            onSelectSuggestion={send}
          />
        </div>
        <ChatComposer
          providers={providers}
          selectedProvider={selectedProvider}
          onSelectProvider={setSelectedProvider}
          onSend={send}
          initialValue={prefillPrompt}
        />
      </div>
    </div>
  )
}
