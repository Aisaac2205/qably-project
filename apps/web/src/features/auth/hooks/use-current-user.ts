'use client'

import { useSession } from '@/lib/auth-client'

export interface CurrentUser {
  name: string
  image: string | null
}

export function useCurrentUser(): CurrentUser {
  const { data } = useSession()

  return {
    name: data?.user.name ?? '',
    image: data?.user.image ?? null,
  }
}
