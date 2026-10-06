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
    vi.restoreAllMocks()
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

  it('cancels the frame it is waiting for when it unmounts, so nothing runs after it', () => {
    const request = vi.spyOn(globalThis, 'requestAnimationFrame')
    const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame')
    const { unmount } = renderSpoken(SHOWN)
    expect(request).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)

    unmount()

    expect(cancel).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledWith(request.mock.results[0].value)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('waits on one frame only when a new event arrives before the first frame', () => {
    const { result, rerender } = renderSpoken(SHOWN)

    rerender({ message: '1 more suite loaded', eventId: 2 })
    expect(vi.getTimerCount()).toBe(1)
    nextFrame()

    expect(result.current).toBe('1 more suite loaded')
  })

  it('asks for no frame when there is no message to say', () => {
    const request = vi.spyOn(globalThis, 'requestAnimationFrame')

    renderSpoken({ message: '', eventId: 0 })

    expect(request).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('follows a change of wording of the same event without emptying the region', () => {
    const { result, rerender } = renderSpoken(SHOWN)
    nextFrame()

    rerender({ message: '3 suites mostradas', eventId: 1 })

    expect(result.current).toBe('3 suites mostradas')
  })
})
