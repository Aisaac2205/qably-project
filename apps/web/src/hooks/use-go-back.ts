'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'

export function useGoBack(fallbackHref: string) {
  const router = useRouter()

  return useCallback(() => {
    if (window.history.length > 1) {
      router.back()
      return
    }

    router.push(fallbackHref)
  }, [router, fallbackHref])
}
