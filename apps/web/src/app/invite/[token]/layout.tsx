import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Qably',
  referrer: 'no-referrer',
}

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
