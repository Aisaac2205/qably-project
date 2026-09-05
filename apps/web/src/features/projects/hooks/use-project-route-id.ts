'use client'

import { useParams } from 'next/navigation'

export function useProjectRouteId(): string | null {
  const params = useParams<{ id?: string | string[] }>()
  const id = params?.id

  return typeof id === 'string' && id !== '' ? id : null
}
