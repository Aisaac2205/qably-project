import { cookies } from 'next/headers'
import { AppShell } from '@/components/shell/app-shell'
import { SessionGate } from '@/features/auth/components/session-gate'

// Written by SidebarProvider on every toggle; read here so a reload opens the
// sidebar the way it was left instead of flashing it open.
const SIDEBAR_COOKIE_NAME = 'sidebar_state'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const sidebarOpen = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value !== 'false'

  return (
    <SessionGate>
      <AppShell defaultSidebarOpen={sidebarOpen}>{children}</AppShell>
    </SessionGate>
  )
}
