'use client'

import { useMemo } from 'react'
import { useAiProviders as useAiProvidersStore } from '@/lib/use-mock-store'

export function useAiProviders() {
  const providers = useAiProvidersStore()
  const connectedProviders = useMemo(() => providers.filter((p) => p.connected), [providers])
  return {
    providers,
    connectedProviders,
    hasConnected: connectedProviders.length > 0,
  }
}
