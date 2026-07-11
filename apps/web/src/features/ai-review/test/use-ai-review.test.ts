import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useAiReview } from '@/features/ai-review/hooks/use-ai-review'
import { __resetStore } from '@/lib/mock-store'

describe('useAiReview confirmAll', () => {
  beforeEach(() => __resetStore())

  it('confirms every pending case for the project and clears the list', () => {
    const { result } = renderHook(() => useAiReview('proj-1'))
    expect(result.current.cases.length).toBeGreaterThan(0)
    act(() => {
      result.current.confirmAll()
    })
    expect(result.current.cases.length).toBe(0)
  })
})
