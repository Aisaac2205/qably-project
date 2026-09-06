'use client'

import { useEffect, useRef, useState } from 'react'
import { useProjectChat } from '@/features/projects/test-generation/hooks/use-project-chat'
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
    pendingMessage,
    startNewChat,
    selectThread,
    send,
  } = useProjectChat(projectId)
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
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />
      <div className="flex flex-col flex-1 min-w-0 h-full min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
          <ChatMessageList
            projectId={projectId}
            messages={messages}
            pendingMessage={pendingMessage}
            onSelectSuggestion={send}
          />
        </div>
        <ChatComposer onSend={send} disabled={isSending} />
      </div>
    </div>
  )
}
