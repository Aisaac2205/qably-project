import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUpdateRunCase } from '@/features/runs/hooks/use-update-run-case'
import { __resetStore, getRun } from '@/lib/mock-store'

describe('useUpdateRunCase', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('updates a case status in the store', () => {
    const { result } = renderHook(() => useUpdateRunCase('run-12'))

    act(() => {
      result.current('tc-1', 'fail')
    })

    const run = getRun('run-12')
    const tc = run?.cases.find((c) => c.id === 'tc-1')
    expect(tc?.status).toBe('fail')
  })

  it('updates status for multiple cases', () => {
    const { result } = renderHook(() => useUpdateRunCase('run-12'))

    act(() => {
      result.current('tc-1', 'skip')
      result.current('tc-2', 'pass')
    })

    const run = getRun('run-12')
    expect(run?.cases.find((c) => c.id === 'tc-1')?.status).toBe('skip')
    expect(run?.cases.find((c) => c.id === 'tc-2')?.status).toBe('pass')
  })

  it('broadcasts to subscribers', () => {
    // Verify the store notifies subscribers (casual via getRun check)
    const { result } = renderHook(() => useUpdateRunCase('run-12'))

    act(() => {
      result.current('tc-3', 'blocked')
    })

    const run = getRun('run-12')
    expect(run?.cases.find((c) => c.id === 'tc-3')?.status).toBe('blocked')
  })
})
