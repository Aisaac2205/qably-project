'use client'

import { useState, useCallback } from 'react'
import { connectAiProvider, disconnectAiProvider } from '@/lib/mock-store'
import type { AiProvider } from '@qably/types'

export function useConnectAiProvider() {
  const [isLoading, setIsLoading] = useState(false)

  const connect = useCallback((provider: AiProvider, apiKey: string) => {
    setIsLoading(true)
    connectAiProvider(provider, apiKey)
    setIsLoading(false)
  }, [])

  const disconnect = useCallback((provider: AiProvider) => {
    setIsLoading(true)
    disconnectAiProvider(provider)
    setIsLoading(false)
  }, [])

  return { connect, disconnect, isLoading }
}
