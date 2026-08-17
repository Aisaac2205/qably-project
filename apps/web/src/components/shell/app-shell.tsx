'use client'

import { useEffect } from 'react'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'
import { registerRunSubscriber } from '@/features/runs'
import { useTranslation } from '@/lib/i18n'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation()
  const focusMainContent = () => document.getElementById('main-content')?.focus()
  // Cross-module glue (per design, Commit 3): the run subscriber listens
  // to CI events on the bus and transitions runs. HMR-safe via cleanup.
  useEffect(() => {
    return registerRunSubscriber()
  }, [])

  return (
    <SidebarProvider defaultOpen={true} className="min-h-dvh w-full overflow-hidden bg-canvas">
      <a
        href="#main-content"
        onClick={focusMainContent}
        className="fixed left-3 top-3 z-50 -translate-y-20 rounded-lg bg-surface px-3 py-2 text-sm font-semibold text-default shadow-pop focus-visible:translate-y-0 focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        {t('common.skipToMain')}
      </a>
      <Sidebar />
      <SidebarInset className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-surface ring-1 ring-border">
        <header role="banner" className="shrink-0">
          <TopBar />
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto bg-surface">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
