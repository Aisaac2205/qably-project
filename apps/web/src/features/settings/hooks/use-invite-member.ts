'use client'

import { useState, useCallback } from 'react'
import { inviteMember } from '@/lib/mock-store'
import type { OrgMember } from '@qably/types'

export function useInviteMember() {
  const [isLoading, setIsLoading] = useState(false)

  const invite = useCallback(async (input: { email: string; role: OrgMember['role'] }) => {
    setIsLoading(true)
    try {
      const member = inviteMember(input)
      return member
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { invite, isLoading }
}
