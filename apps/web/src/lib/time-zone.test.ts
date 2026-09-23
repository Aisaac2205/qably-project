import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBrowserTimeZone, useBrowserTimeZone } from '@/lib/time-zone'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getBrowserTimeZone', () => {
  it('returns the timeZone Intl resolves for the current environment', () => {
    const spy = vi
      .spyOn(Intl, 'DateTimeFormat')
      .mockImplementation(
        () =>
          ({
            resolvedOptions: () => ({ timeZone: 'America/Guatemala' }),
          }) as unknown as Intl.DateTimeFormat,
      )

    expect(getBrowserTimeZone()).toBe('America/Guatemala')

    spy.mockRestore()
  })

  it('falls back to UTC if Intl throws', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('unsupported')
    })

    expect(getBrowserTimeZone()).toBe('UTC')

    spy.mockRestore()
  })
})

describe('useBrowserTimeZone', () => {
  it('resolves to the browser time zone once mounted on the client', () => {
    const { result } = renderHook(() => useBrowserTimeZone())

    expect(result.current).toBe(getBrowserTimeZone())
  })
})
