'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { CircleNotch } from '@phosphor-icons/react'
import { useSession } from '@/lib/auth-client'
import { useTranslation } from '@/lib/i18n'

const DEFAULT_DESTINATION = '/dashboard'

export function buildLoginPath(pathname: string): string {
  if (pathname === DEFAULT_DESTINATION) return '/login'

  return `/login?next=${encodeURIComponent(pathname)}`
}

export function SessionGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { data, isPending } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const isSignedIn = data != null

  useEffect(() => {
    if (isPending || isSignedIn) return

    router.replace(buildLoginPath(pathname))
  }, [isPending, isSignedIn, pathname, router])

  if (isPending) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center bg-canvas text-muted"
        role="status"
        aria-live="polite"
      >
        <CircleNotch className="size-5 animate-spin" aria-hidden="true" />
        <span className="ml-2.5 text-sm">{t('common.loading')}</span>
      </div>
    )
  }

  if (!isSignedIn) return null

  return <>{children}</>
}
