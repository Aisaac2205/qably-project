'use client'

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider defaultOpen={true} className="h-screen w-screen overflow-hidden bg-canvas">
      <Sidebar />
      <SidebarInset className="flex flex-col min-w-0 h-screen">
        <header role="banner" className="shrink-0">
          <TopBar />
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
