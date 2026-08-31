import { AppShell } from '@/components/shell/app-shell'
import { SessionGate } from '@/features/auth/components/session-gate'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionGate>
      <AppShell>{children}</AppShell>
    </SessionGate>
  )
}
