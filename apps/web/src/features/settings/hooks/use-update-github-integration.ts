'use client'

import { useState, useCallback } from 'react'
import { updateIntegration } from '@/lib/mock-store'
import type { GithubIntegration } from '@qably/types'

export function useUpdateGithubIntegration() {
  const [isLoading, setIsLoading] = useState(false)

  const update = useCallback(async (patch: Partial<GithubIntegration>) => {
    setIsLoading(true)
    try {
      const result = updateIntegration(patch)
      return result
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { update, isLoading }
}
