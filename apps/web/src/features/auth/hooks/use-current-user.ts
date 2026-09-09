'use client'

import { useSession } from '@/lib/auth-client'
import { normalizeAvatarUrl } from '@/features/auth/lib/user-identity'

export interface CurrentUser {
  name: string
  image: string | null
}

export function useCurrentUser(): CurrentUser {
  const { data } = useSession()

  return {
    name: data?.user.name ?? '',
    image: normalizeAvatarUrl(data?.user.image ?? null),
  }
}
