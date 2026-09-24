'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { registerQueryClient } from '@/lib/query-client-registry'
import { resetQueriesForOrganizationChange } from '@/lib/organization-context'
import { ACTIVE_ORGANIZATION_STORAGE_KEY, useActiveOrganizationStore } from '@/stores/active-organization.store'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  )

  useEffect(() => {
    registerQueryClient(queryClient)

    function handleStorage(event: StorageEvent) {
      if (event.key !== ACTIVE_ORGANIZATION_STORAGE_KEY) return

      void (async () => {
        await useActiveOrganizationStore.persist.rehydrate()
        await resetQueriesForOrganizationChange(queryClient)
      })()
    }

    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [queryClient])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
