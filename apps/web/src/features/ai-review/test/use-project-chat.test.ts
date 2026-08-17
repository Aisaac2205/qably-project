import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useProjectChat } from '@/features/projects/test-generation/hooks/use-project-chat'
import { __resetStore } from '@/lib/mock-store'

describe('useProjectChat', () => {
  beforeEach(() => __resetStore())

  it('starts in draft state with activeThreadId null and empty messages', () => {
    const { result } = renderHook(() => useProjectChat('proj-1'))
    expect(result.current.activeThreadId).toBeNull()
    expect(result.current.messages.length).toBe(0)
    expect(result.current.threads.length).toBeGreaterThan(0)
  })

  it('allows selecting an existing seeded thread and viewing its messages', () => {
    const { result } = renderHook(() => useProjectChat('proj-1'))
    const seededThreadId = result.current.threads[0].id
    act(() => {
      result.current.selectThread(seededThreadId)
    })
    expect(result.current.activeThreadId).toBe(seededThreadId)
    expect(result.current.messages.length).toBe(2)
  })

  it('creates a new thread and selects it upon sending first message in draft state', () => {
    const { result } = renderHook(() => useProjectChat('proj-1'))
    const initialThreadCount = result.current.threads.length

    act(() => {
      result.current.send('How many suites exist?')
    })

    expect(result.current.activeThreadId).not.toBeNull()
    expect(result.current.threads.length).toBe(initialThreadCount + 1)
    expect(result.current.messages.length).toBe(2)
  })

  it('resets to draft state when startNewChat is called', () => {
    const { result } = renderHook(() => useProjectChat('proj-1'))
    const seededThreadId = result.current.threads[0].id
    act(() => {
      result.current.selectThread(seededThreadId)
    })
    expect(result.current.activeThreadId).toBe(seededThreadId)

    act(() => {
      result.current.startNewChat()
    })
    expect(result.current.activeThreadId).toBeNull()
    expect(result.current.messages.length).toBe(0)
  })

  it('removes thread and resets activeThreadId to null if the active thread is deleted', () => {
    const { result } = renderHook(() => useProjectChat('proj-1'))
    const seededThreadId = result.current.threads[0].id
    act(() => {
      result.current.selectThread(seededThreadId)
    })
    expect(result.current.activeThreadId).toBe(seededThreadId)

    act(() => {
      result.current.removeThread(seededThreadId)
    })
    expect(result.current.activeThreadId).toBeNull()
    expect(result.current.threads.find((t) => t.id === seededThreadId)).toBeUndefined()
  })
})
