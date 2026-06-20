'use client'

import { useState, useCallback } from 'react'
import { createApiKey } from '@/lib/mock-store'

export function useCreateApiKey() {
  const [isLoading, setIsLoading] = useState(false)

  const create = useCallback(async (name: string) => {
    setIsLoading(true)
    try {
      const key = createApiKey(name)
      return key
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { create, isLoading }
}
