'use client'

import { useState } from 'react'
import { Plus, Trash, ChatCircleText } from '@phosphor-icons/react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ChatThread, ChatMessage } from '@qably/types'

interface ChatThreadSidebarProps {
  threads: ChatThread[]
  activeThreadId: string | null
  onSelectThread: (threadId: string) => void
  onNewChat: () => void
  onDeleteThread: (threadId: string) => void
  messages: ChatMessage[]
}

export function ChatThreadSidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  messages,
}: ChatThreadSidebarProps) {
  const { t } = useTranslation()
  const [threadIdToDelete, setThreadIdToDelete] = useState<string | null>(null)

  return (
    <aside
      aria-label={t('aiReview.projectChat')}
      className="w-60 shrink-0 flex flex-col h-full bg-surface border-r border-border min-h-0"
    >
      <div className="p-3 border-b border-border shrink-0">
        <button
          type="button"
          onClick={onNewChat}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-[0.98]',
            'shadow-xs focus-visible:outline-2 focus-visible:outline-primary',
            activeThreadId === null
              ? 'bg-primary text-primary-fg hover:bg-primary-hover'
              : 'bg-surface hover:bg-surface-hover text-default border border-border'
          )}
        >
          <Plus size={15} weight="bold" aria-hidden="true" />
          <span>{t('aiReview.newChat')}</span>
        </button>
      </div>

      <div className="px-3 pt-3 pb-1.5 flex items-center justify-between shrink-0">
        <span className="text-xs font-medium text-muted">
          {t('aiReview.chatConversations')}
        </span>
        {threads.length > 0 && (
          <span className="text-xs font-medium tabular-nums text-muted font-mono bg-canvas px-1.5 py-0.5 rounded border border-border/60">
            {threads.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-2 py-1 space-y-1" role="list">
        {threads.length === 0 ? (
          <p className="text-xs text-muted px-2 py-6 text-center">{t('aiReview.noChats')}</p>
        ) : (
          threads.map((thread) => {
            const isActive = activeThreadId === thread.id
            const userMsg = messages.find(
              (m) => m.threadId === thread.id && m.role === 'user'
            )
            const title = userMsg?.content || t('aiReview.newChat')

            return (
              <div
                key={thread.id}
                role="listitem"
                className={cn(
                  'group relative flex items-center gap-2 w-full rounded-lg px-2.5 py-2 text-xs transition-all duration-150 cursor-pointer',
                  isActive
                    ? 'bg-surface text-default font-semibold shadow-xs border border-border'
                    : 'text-muted hover:text-default hover:bg-surface/70 border border-transparent'
                )}
                onClick={() => onSelectThread(thread.id)}
              >
                <ChatCircleText
                  size={15}
                  weight={isActive ? 'fill' : 'regular'}
                  className={cn(
                    'shrink-0 transition-colors',
                    isActive ? 'text-primary' : 'text-muted group-hover:text-default'
                  )}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectThread(thread.id)
                  }}
                  aria-current={isActive ? 'true' : undefined}
                  className="flex-1 min-w-0 text-left truncate focus-visible:outline-2 focus-visible:outline-primary rounded"
                  title={title}
                >
                  {title}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setThreadIdToDelete(thread.id)
                  }}
                  aria-label={t('aiReview.deleteChatAria')}
                  className={cn(
                    'size-6 shrink-0 inline-flex items-center justify-center rounded text-muted hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-2 focus-visible:outline-primary',
                    'opacity-0 group-hover:opacity-100 focus:opacity-100 group-focus-within:opacity-100'
                  )}
                >
                  <Trash size={13} aria-hidden="true" />
                </button>
              </div>
            )
          })
        )}
      </div>

      <ConfirmDialog
        open={!!threadIdToDelete}
        onOpenChange={(open) => !open && setThreadIdToDelete(null)}
        title={t('aiReview.deleteChatTitle')}
        description={t('aiReview.deleteChatDesc')}
        onConfirm={() => {
          if (threadIdToDelete) {
            onDeleteThread(threadIdToDelete)
            setThreadIdToDelete(null)
          }
        }}
      />
    </aside>
  )
}
