'use client'

import { useState, useCallback } from 'react'
import { revokeApiKey } from '@/lib/mock-store'

export function useRevokeApiKey() {
  const [isLoading, setIsLoading] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const requestRevoke = useCallback((id: string) => {
    setConfirmingId(id)
  }, [])

  const cancelRevoke = useCallback(() => {
    setConfirmingId(null)
  }, [])

  const confirmRevoke = useCallback(async (id: string) => {
    setIsLoading(true)
    try {
      revokeApiKey(id)
      setConfirmingId(null)
      return true
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { isLoading, confirmingId, requestRevoke, cancelRevoke, confirmRevoke }
}
