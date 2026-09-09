'use client'

import { useEffect, useRef, useState } from 'react'
import { useProjectChat } from '@/features/projects/test-generation/hooks/use-project-chat'
import { useTranslation } from '@/lib/i18n'
import { ChatMessageList } from './chat-message-list'
import { ChatComposer } from './chat-composer'
import { ChatThreadSidebar } from './chat-thread-sidebar'

const CHAT_SIDEBAR_STORAGE_KEY = 'qably:project-chat-sidebar-collapsed'

function getInitialSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(CHAT_SIDEBAR_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function ProjectChatPanel({ projectId }: { projectId: string }) {
  const {
    threads,
    activeThreadId,
    messages,
    isLoadingThread,
    pendingMessage,
    deleteError,
    startNewChat,
    selectThread,
    removeThread,
    send,
  } = useProjectChat(projectId)
  const { t } = useTranslation()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getInitialSidebarCollapsed)
  const scrollRef = useRef<HTMLDivElement>(null)

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(CHAT_SIDEBAR_STORAGE_KEY, String(next))
      } catch {
        void 0
      }
      return next
    })
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, pendingMessage])

  const isSending = pendingMessage?.status === 'sending'

  return (
    <div className="flex h-full min-h-0">
      <ChatThreadSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onSelectThread={selectThread}
        onNewChat={startNewChat}
        onDeleteThread={removeThread}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />
      <div className="flex flex-col flex-1 min-w-0 h-full min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
          <ChatMessageList
            projectId={projectId}
            messages={messages}
            pendingMessage={pendingMessage}
            isLoadingThread={isLoadingThread}
            onSelectSuggestion={send}
          />
        </div>
        {deleteError && (
          <p
            role="alert"
            className="mx-4 mb-2 rounded-lg border border-fail/30 bg-fail-bg px-3 py-2 text-xs text-fail sm:mx-6"
          >
            {t('aiReview.deleteChatError')}
          </p>
        )}
        <ChatComposer onSend={send} disabled={isSending} />
      </div>
    </div>
  )
}
