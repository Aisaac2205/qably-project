import Link from 'next/link'
import { QablyWordmark } from '@/features/auth/components/brand-marks'
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
            <QablyWordmark className="h-8 w-auto text-foreground" />
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
