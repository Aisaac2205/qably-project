'use client'

import { useState } from 'react'
import { ClockCounterClockwise, Plus, Trash, X } from '@phosphor-icons/react'
import { AerisIcon } from '@/components/icons/aeris-icon'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ChatThreadRecord } from '@qably/types'
import { ASSISTANT_NAME } from '../lib/assistant-name'

interface ChatThreadSidebarProps {
  threads: ChatThreadRecord[]
  activeThreadId: string | null
  onSelectThread: (threadId: string) => void
  onNewChat: () => void
  onDeleteThread?: (threadId: string) => void
  /** `panel` sits beside the chat and can collapse to a rail; `drawer` fills a mobile sheet. */
  variant?: 'panel' | 'drawer'
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  onClose?: () => void
}

const iconButtonClass =
  'inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-canvas-hover hover:text-default focus-visible:outline-2 focus-visible:outline-primary'

// One aside for both states, so its width can animate between the rail and
// the panel. The rail keeps only the mark, in the same place it sits in the
// panel; New chat and the conversations only exist while it is open.
export function ChatThreadSidebar({
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  variant = 'panel',
  isCollapsed = false,
  onToggleCollapse,
  onClose,
}: ChatThreadSidebarProps) {
  const { t } = useTranslation()
  const [threadPendingDeletion, setThreadPendingDeletion] = useState<string | null>(null)
  const isDrawer = variant === 'drawer'
  const isRail = !isDrawer && isCollapsed

  return (
    <aside
      aria-label={t('aiReview.projectChat')}
      className={cn(
        'flex h-full min-h-0 shrink-0 flex-col overflow-hidden bg-surface',
        isDrawer
          ? 'w-full'
          : 'transition-[width] duration-200 ease-out-quart motion-reduce:transition-none',
        // The rail drops its border instead of making it transparent: the
        // unlayered base border-color in globals.css outranks border-transparent.
        !isDrawer && (isRail ? 'w-18 border-r-0' : 'w-64 border-r border-border'),
      )}
    >
      {/* On the rail the button starts 18px in, the same column as the app
          sidebar toggle in the top bar (px-6 less its -ml-1.5). */}
      <div className={cn('flex h-14 shrink-0 items-center gap-1', isRail ? 'px-4.5' : 'px-2.5')}>
        {isRail ? (
          onToggleCollapse && (
            <button
              type="button"
              data-slot="sidebar-trigger"
              data-sidebar="trigger"
              aria-expanded={false}
              onClick={onToggleCollapse}
              title={t('aiReview.expandSidebar')}
              className={iconButtonClass}
            >
              {/* History, not the usual panel icon: the app's own sidebar toggle
                  sits right above with that icon, and two identical toggles
                  leave the user guessing which panel each one opens. */}
              <ClockCounterClockwise size={18} aria-hidden="true" />
              <span className="sr-only">{t('aiReview.expandSidebar')}</span>
            </button>
          )
        ) : (
          <>
            <p className="flex min-w-0 flex-1 animate-page-enter items-center gap-2.5 px-2">
              <AerisIcon size={20} />
              <span className="truncate text-base font-semibold tracking-tight text-default">
                {ASSISTANT_NAME}
              </span>
            </p>
            {isDrawer && onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={t('common.close')}
                title={t('common.close')}
                className={iconButtonClass}
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
            {!isDrawer && onToggleCollapse && (
              <button
                type="button"
                data-slot="sidebar-trigger"
                data-sidebar="trigger"
                aria-expanded={true}
                onClick={onToggleCollapse}
                aria-label={t('aiReview.collapseSidebar')}
                title={t('aiReview.collapseSidebar')}
                className={iconButtonClass}
              >
                <ClockCounterClockwise size={18} aria-hidden="true" />
              </button>
            )}
          </>
        )}
      </div>

      {!isRail && (
        <div className="flex min-h-0 flex-1 animate-page-enter flex-col">
          <div className="shrink-0 px-2.5">
            <button
              type="button"
              onClick={onNewChat}
              className={cn(
                'flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-default transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary md:h-9',
                activeThreadId === null ? 'bg-canvas hover:bg-canvas-hover' : 'hover:bg-canvas-hover',
              )}
            >
              <Plus size={16} weight="bold" aria-hidden="true" className="shrink-0" />
              <span className="truncate whitespace-nowrap">{t('aiReview.newChat')}</span>
            </button>
          </div>

          <p className="shrink-0 px-5 pt-5 pb-1.5 text-xs font-medium text-muted">
            {t('aiReview.chatConversations')}
          </p>

          <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3" role="list">
            {threads.length === 0 ? (
              <p className="px-2.5 py-2 text-sm text-muted">{t('aiReview.noChats')}</p>
            ) : (
              threads.map((thread) => {
                const isActive = activeThreadId === thread.id

                return (
                  <div key={thread.id} role="listitem" className="group relative">
                    <button
                      type="button"
                      onClick={() => onSelectThread(thread.id)}
                      aria-current={isActive ? 'true' : undefined}
                      title={thread.title}
                      className={cn(
                        'flex h-10 w-full cursor-pointer items-center rounded-lg px-2.5 text-left text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-primary md:h-9',
                        onDeleteThread && 'pr-10',
                        isActive
                          ? 'bg-canvas font-medium text-default'
                          : 'text-muted hover:bg-canvas-hover hover:text-default',
                      )}
                    >
                      <span className="min-w-0 truncate">{thread.title}</span>
                    </button>

                    {onDeleteThread && (
                      <button
                        type="button"
                        onClick={() => setThreadPendingDeletion(thread.id)}
                        aria-label={t('aiReview.deleteChatAria')}
                        title={t('aiReview.deleteChatAria')}
                        className={cn(
                          'absolute top-1/2 right-1 inline-flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md md:size-7',
                          'text-muted transition-[opacity,color,background-color] duration-150 hover:bg-fail-bg hover:text-fail',
                          'focus-visible:outline-2 focus-visible:outline-primary',
                          'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100 pointer-coarse:opacity-100',
                        )}
                      >
                        <Trash size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {onDeleteThread && (
        <ConfirmDialog
          open={threadPendingDeletion !== null}
          onOpenChange={(open) => {
            if (!open) setThreadPendingDeletion(null)
          }}
          title={t('aiReview.deleteChatTitle')}
          description={t('aiReview.deleteChatDesc')}
          onConfirm={() => {
            if (threadPendingDeletion !== null) onDeleteThread(threadPendingDeletion)
          }}
        />
      )}
    </aside>
  )
}
