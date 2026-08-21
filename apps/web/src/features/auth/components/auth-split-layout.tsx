import Link from 'next/link'
import { GradientMesh } from '@/features/auth/components/gradient-mesh'

interface AuthSplitLayoutProps {
  children: React.ReactNode
}

export function AuthSplitLayout({ children }: AuthSplitLayoutProps) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" aria-label="Qably home" className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Qably</span>
          </Link>
        </div>
        <div className="flex w-full flex-1 items-center justify-center">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
      <div className="relative hidden bg-canvas lg:block">
        <GradientMesh />
      </div>
    </div>
  )
}
