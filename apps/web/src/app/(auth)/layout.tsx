import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Qably',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-canvas">{children}</div>
}
