'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CaretLeft, ChatsCircle } from '@phosphor-icons/react'
import { useProjectChat } from '@/features/projects/test-generation/hooks/use-project-chat'
import { useSuites } from '@/features/projects/suites/hooks/use-suites'
import { flattenAttachableCases } from '@/features/ai-review/lib/attachable-cases'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { AerisChat } from './aeris-chat'
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

export function ProjectChatPanel({
  projectId,
  onExit,
}: {
  projectId: string
  onExit?: () => void
}) {
  const chat = useProjectChat(projectId)
  const {
    threads,
    activeThreadId,
    isLoadingThread,
    deleteError,
    startNewChat,
    selectThread,
    removeThread,
  } = chat
  const { t } = useTranslation()
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(getInitialSidebarCollapsed)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const searchParams = useSearchParams()
  const [initialCaseId] = useState(() => searchParams.get('case'))
  const { suites, isLoading: isSuitesLoading } = useSuites(projectId)
  const isResolvingInitialCase = initialCaseId !== null && isSuitesLoading
  const initialAttachedCase = useMemo(
    () =>
      initialCaseId === null
        ? undefined
        : flattenAttachableCases(suites).find((attachedCase) => attachedCase.id === initialCaseId),
    [initialCaseId, suites],
  )

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

  return (
    <div className="flex h-full min-h-0">
      <h1 className="sr-only">{t('aiReview.projectChat')}</h1>

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
          // Same data-[side=left] variant as the sheet's own width, or its 3/4
          // width outranks these and leaves a blank strip beside the sidebar.
          className="gap-0 border-r-0 p-0 data-[side=left]:w-4/5 data-[side=left]:max-w-80 data-[side=left]:sm:max-w-80 md:hidden"
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
            variant="drawer"
            onClose={() => setIsDrawerOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex flex-col flex-1 min-w-0 h-full min-h-0">
        <div className={cn('flex items-center gap-2 shrink-0 bg-surface px-2 py-2 sm:px-4', !onExit && 'md:hidden')}>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              aria-label={t('aiReview.backToQueue')}
              title={t('aiReview.backToQueue')}
              className="inline-flex shrink-0 items-center gap-0.5 rounded-lg py-1.5 pl-1 pr-2 text-xs font-semibold text-muted hover:text-default hover:bg-surface-hover transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-primary"
            >
              <CaretLeft size={16} weight="bold" aria-hidden="true" />
              <span className="max-w-32 truncate sm:max-w-none">
                {t('aiReview.reviewQueue')}
              </span>
            </button>
          )}

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-label={t('aiReview.openConversations')}
            title={t('aiReview.openConversations')}
            className="md:hidden size-8 shrink-0 rounded-lg inline-flex items-center justify-center text-muted hover:text-default hover:bg-surface-hover transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-primary"
          >
            <ChatsCircle size={18} weight="regular" aria-hidden="true" />
          </button>
        </div>

        <AerisChat
          key={isResolvingInitialCase ? 'resolving-initial-case' : 'ready'}
          projectId={projectId}
          chat={chat}
          isLoadingThread={isLoadingThread}
          deleteError={deleteError}
          initialAttachedCase={activeThreadId === null ? initialAttachedCase : undefined}
        />
      </div>
    </div>
  )
}
