import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas">
      <nav aria-label="sidebar" className="shrink-0 h-full">
        <Sidebar />
      </nav>
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <header role="banner" className="shrink-0">
          <TopBar />
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
