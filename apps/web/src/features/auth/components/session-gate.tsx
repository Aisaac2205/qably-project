'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Spinner } from '@/components/ui/spinner'
import { useSession } from '@/lib/auth-client'
import { useTranslation } from '@/lib/i18n'
import { applyOrganizationChange } from '@/lib/organization-context'

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
  const queryClient = useQueryClient()
  const isSignedIn = data != null

  useEffect(() => {
    if (isPending || isSignedIn) return

    void applyOrganizationChange(queryClient, null)
    router.replace(buildLoginPath(pathname))
  }, [isPending, isSignedIn, pathname, router, queryClient])

  if (isPending) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center bg-canvas text-muted"
        role="status"
        aria-live="polite"
      >
        <Spinner size="lg" />
        <span className="ml-2.5 text-sm">{t('common.loading')}</span>
      </div>
    )
  }

  if (!isSignedIn) return null

  return <>{children}</>
}
