'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { List } from '@phosphor-icons/react'
import { ASSISTANT_MODEL_NAME } from '@qably/types'
import { useProjectChat } from '@/features/projects/test-generation/hooks/use-project-chat'
import { AerisIcon } from '@/components/icons/aeris-icon'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
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
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
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

  const activeTitle = useMemo(() => {
    const active = threads.find((thread) => thread.id === activeThreadId)
    return active?.title ?? t('aiReview.newChat')
  }, [threads, activeThreadId, t])

  return (
    <div className="flex h-full min-h-0">
      <div className="hidden md:flex md:h-full md:min-h-0">
        <ChatThreadSidebar
          threads={threads}
          activeThreadId={activeThreadId}
          onSelectThread={selectThread}
          onNewChat={startNewChat}
          onDeleteThread={removeThread}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
        />
      </div>

      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-64 gap-0 p-0 sm:max-w-64 md:hidden"
        >
          <SheetTitle className="sr-only">{t('aiReview.chatConversations')}</SheetTitle>
          <ChatThreadSidebar
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={(threadId) => {
              selectThread(threadId)
              setIsDrawerOpen(false)
            }}
            onNewChat={() => {
              startNewChat()
              setIsDrawerOpen(false)
            }}
            onDeleteThread={removeThread}
          />
        </SheetContent>
      </Sheet>

      <div className="flex flex-col flex-1 min-w-0 h-full min-h-0">
        <div className="flex items-center gap-2 shrink-0 border-b border-border bg-surface px-3 py-2 sm:px-4">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-label={t('aiReview.openConversations')}
            title={t('aiReview.openConversations')}
            className="md:hidden size-8 shrink-0 rounded-lg inline-flex items-center justify-center text-muted hover:text-default hover:bg-surface-hover transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-primary"
          >
            <List size={18} weight="regular" aria-hidden="true" />
          </button>

          <h2 className="flex-1 min-w-0 truncate text-xs sm:text-sm font-semibold text-default">
            {activeTitle}
          </h2>

          <p className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/60 bg-canvas/50 px-2 py-1 text-[11px] font-semibold text-muted">
            <AerisIcon size={13} className="text-primary" />
            <span className="sr-only">{t('aiReview.modelLabel')}: </span>
            <span>{ASSISTANT_MODEL_NAME}</span>
          </p>
        </div>

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
            className="mx-3 mb-2 rounded-lg border border-fail/30 bg-fail-bg px-3 py-2 text-xs text-fail sm:mx-4"
          >
            {t('aiReview.deleteChatError')}
          </p>
        )}

        <ChatComposer onSend={send} disabled={isSending} />
      </div>
    </div>
  )
}
