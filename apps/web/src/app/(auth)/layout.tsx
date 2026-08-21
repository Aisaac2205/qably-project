import type { Metadata } from 'next'
import { AuthSplitLayout } from '@/features/auth/components/auth-split-layout'

export const metadata: Metadata = {
  title: 'Qably',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthSplitLayout>{children}</AuthSplitLayout>
}
