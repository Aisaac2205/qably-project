import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpokenMessage } from '@/features/projects/suites/hooks/use-spoken-message'

interface Props {
  message: string
  eventId: number
}

const SHOWN: Props = { message: '3 suites shown', eventId: 1 }

function renderSpoken(initial: Props) {
  return renderHook((props: Props) => useSpokenMessage(props.message, props.eventId), {
    initialProps: initial,
  })
}

function nextFrame() {
  act(() => {
    vi.advanceTimersByTime(16)
  })
}

describe('useSpokenMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('says nothing while there is no message', () => {
    const { result } = renderSpoken({ message: '', eventId: 0 })
    nextFrame()

    expect(result.current).toBe('')
  })

  it('says the message on the frame after it arrives, not in the same render', () => {
    const { result } = renderSpoken(SHOWN)
    expect(result.current).toBe('')

    nextFrame()

    expect(result.current).toBe('3 suites shown')
  })

  it('keeps the message while nothing new happens', () => {
    const { result, rerender } = renderSpoken(SHOWN)
    nextFrame()

    rerender(SHOWN)
    nextFrame()

    expect(result.current).toBe('3 suites shown')
  })

  it('empties the region and says an identical message again when a new event brings it', () => {
    const { result, rerender } = renderSpoken(SHOWN)
    nextFrame()
    expect(result.current).toBe('3 suites shown')

    rerender({ message: '3 suites shown', eventId: 2 })
    expect(result.current).toBe('')

    nextFrame()
    expect(result.current).toBe('3 suites shown')
  })

  it('says a different message of a new event on the frame after it, with the old one gone at once', () => {
    const { result, rerender } = renderSpoken(SHOWN)
    nextFrame()

    rerender({ message: '1 more suite loaded', eventId: 2 })
    expect(result.current).toBe('')

    nextFrame()
    expect(result.current).toBe('1 more suite loaded')
  })

  it('drops the message at once when it goes away', () => {
    const { result, rerender } = renderSpoken(SHOWN)
    nextFrame()

    rerender({ message: '', eventId: 1 })

    expect(result.current).toBe('')
  })

  it('follows a change of wording of the same event without emptying the region', () => {
    const { result, rerender } = renderSpoken(SHOWN)
    nextFrame()

    rerender({ message: '3 suites mostradas', eventId: 1 })

    expect(result.current).toBe('3 suites mostradas')
  })
})
