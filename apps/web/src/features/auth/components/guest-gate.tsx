'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth-client'
import { resolveDestination } from '@/features/auth/lib/destination'

export function GuestGate({ children }: { children: React.ReactNode }) {
  const { data, isPending } = useSession()
  const router = useRouter()
  const isSignedIn = data != null

  useEffect(() => {
    if (isPending || !isSignedIn) return

    router.replace(resolveDestination(window.location.search))
  }, [isPending, isSignedIn, router])

  if (isPending || isSignedIn) return null

  return <>{children}</>
}
