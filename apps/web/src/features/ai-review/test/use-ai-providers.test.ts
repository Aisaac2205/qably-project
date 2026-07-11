import { renderHook } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useAiProviders } from '@/features/ai-review/hooks/use-ai-providers'
import { __resetStore } from '@/lib/mock-store'

describe('useAiProviders', () => {
  beforeEach(() => __resetStore())

  it('reports Claude as the only connected provider by default', () => {
    const { result } = renderHook(() => useAiProviders())
    expect(result.current.hasConnected).toBe(true)
    expect(result.current.connectedProviders.map((p) => p.provider)).toEqual(['claude'])
  })
})
