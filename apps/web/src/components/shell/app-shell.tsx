import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex flex-col h-screen">
      <header role="banner">
        <TopBar />
      </header>
      <div className="flex flex-1 overflow-hidden">
        <nav aria-label="sidebar">
          <Sidebar />
        </nav>
        <main className="flex-1 overflow-auto bg-canvas">
          {children}
        </main>
      </div>
    </div>
  )
}
