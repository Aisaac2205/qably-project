'use client'

import { useRef } from 'react'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'
import { useTranslation } from '@/lib/i18n'
import { useScrollRestoration } from '@/hooks/use-scroll-restoration'

interface AppShellProps {
  children: React.ReactNode
}

function focusMainContent() {
  document.getElementById('main-content')?.focus()
}

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation()
  const mainRef = useRef<HTMLElement>(null)

  useScrollRestoration(mainRef)

  return (
    <SidebarProvider defaultOpen={true} className="h-dvh w-full overflow-hidden bg-surface">
      <a
        href="#main-content"
        onClick={focusMainContent}
        className="fixed left-3 top-3 z-50 -translate-y-20 rounded-lg bg-surface px-3 py-2 text-sm font-semibold text-default shadow-pop focus-visible:translate-y-0 focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        {t('common.skipToMain')}
      </a>
      <Sidebar />
      <SidebarInset className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-surface md:border-l md:border-border">
        <header className="shrink-0">
          <TopBar />
        </header>
        <main
          ref={mainRef}
          id="main-content"
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-auto bg-surface flex flex-col"
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
