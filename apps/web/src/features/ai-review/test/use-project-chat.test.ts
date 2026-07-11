import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectChat } from '@/features/ai-review/hooks/use-project-chat'
import { __resetStore } from '@/lib/mock-store'

describe('useProjectChat', () => {
  beforeEach(() => __resetStore())

  it('exposes the seeded messages for proj-1', () => {
    const { result } = renderHook(() => useProjectChat('proj-1'))
    expect(result.current.messages.length).toBe(2)
  })

  it('appends messages when send is called', () => {
    const { result } = renderHook(() => useProjectChat('proj-1'))
    act(() => {
      result.current.send('How many suites exist?')
    })
    expect(result.current.messages.length).toBe(4)
  })
})
