import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cancelNewRunFocus,
  consumeNewRunFocus,
  requestNewRunFocus,
} from '@/features/runs/lib/new-run-focus'

afterEach(() => {
  cancelNewRunFocus()
  vi.restoreAllMocks()
})

describe('the new run focus handoff', () => {
  it('hands the request to the first consumer only', () => {
    requestNewRunFocus('proj-1')

    expect(consumeNewRunFocus('proj-1')).toBe(true)
    expect(consumeNewRunFocus('proj-1')).toBe(false)
  })

  it('has nothing to hand over when nobody asked', () => {
    expect(consumeNewRunFocus('proj-1')).toBe(false)
  })

  it('still hands the request over a moment later', () => {
    const now = Date.now()
    requestNewRunFocus('proj-1')
    vi.spyOn(Date, 'now').mockReturnValue(now + 3500)

    expect(consumeNewRunFocus('proj-1')).toBe(true)
  })

  it('drops the request when nothing consumed it within the window, so a later visit is left alone', () => {
    const now = Date.now()
    requestNewRunFocus('proj-1')
    vi.spyOn(Date, 'now').mockReturnValue(now + 10_000)

    expect(consumeNewRunFocus('proj-1')).toBe(false)
    vi.restoreAllMocks()
    expect(consumeNewRunFocus('proj-1')).toBe(false)
  })

  it('keeps a request for its own project away from the list of another one', () => {
    requestNewRunFocus('proj-1')

    expect(consumeNewRunFocus('proj-2')).toBe(false)
    expect(consumeNewRunFocus('proj-1')).toBe(true)
  })

  it('can be cancelled before anyone consumes it', () => {
    requestNewRunFocus('proj-1')

    cancelNewRunFocus()

    expect(consumeNewRunFocus('proj-1')).toBe(false)
  })

  it('restarts the window when it is asked again', () => {
    const now = Date.now()
    requestNewRunFocus('proj-1')
    vi.spyOn(Date, 'now').mockReturnValue(now + 4000)
    requestNewRunFocus('proj-1')
    vi.spyOn(Date, 'now').mockReturnValue(now + 8000)

    expect(consumeNewRunFocus('proj-1')).toBe(true)
  })
})
