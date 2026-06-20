import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Qably',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      {children}
    </div>
  )
}
