import type { Metadata } from 'next'
import { AuthSplitLayout } from '@/features/auth/components/auth-split-layout'
import { GuestGate } from '@/features/auth/components/guest-gate'

export const metadata: Metadata = {
  title: 'Qably',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <GuestGate>
      <AuthSplitLayout>{children}</AuthSplitLayout>
    </GuestGate>
  )
}
