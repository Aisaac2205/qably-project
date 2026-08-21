import { createAuthClient } from 'better-auth/react'
import { resolveApiBaseUrl } from '@/lib/api-base-url'

export const authClient = createAuthClient({
  baseURL: resolveApiBaseUrl(),
  fetchOptions: {
    credentials: 'include',
  },
})

export const { signOut, useSession } = authClient
