import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { TraceabilityCalendarRecord } from '@qably/types'
import { useTraceabilityCalendar } from './use-traceability-calendar'
import { getTraceabilityCalendar } from '../api/dashboard.api'
import { dashboardKeys } from '../lib/query-keys'
import { useBrowserTimeZone } from '@/lib/time-zone'

vi.mock('../api/dashboard.api', () => ({ getTraceabilityCalendar: vi.fn() }))

vi.mock('@/lib/time-zone', async () => {
  const actual = await vi.importActual<typeof import('@/lib/time-zone')>('@/lib/time-zone')
  return { ...actual, useBrowserTimeZone: vi.fn() }
})

const fetchTraceability = vi.mocked(getTraceabilityCalendar)
const browserTimeZone = vi.mocked(useBrowserTimeZone)

const record: TraceabilityCalendarRecord = {
  year: 2026,
  timeZone: 'America/Guatemala',
  totals: { scm: 0, proposals: 0, official: 0, runs: 0 },
  days: [],
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  fetchTraceability.mockResolvedValue(record)
})

describe('useTraceabilityCalendar', () => {
  it('never queries while the browser time zone has not resolved (server snapshot)', () => {
    browserTimeZone.mockReturnValue(undefined)

    const { result } = renderHook(() => useTraceabilityCalendar({ year: 2026 }), { wrapper })

    expect(fetchTraceability).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(true)
  })

  it('queries with the browser time zone once it resolves after mount', async () => {
    browserTimeZone.mockReturnValue('America/Guatemala')

    renderHook(() => useTraceabilityCalendar({ year: 2026 }), { wrapper })

    await waitFor(() =>
      expect(fetchTraceability).toHaveBeenCalledWith(
        2026,
        'America/Guatemala',
        undefined,
        expect.anything(),
      ),
    )
  })

  it('keys the query by the resolved time zone', async () => {
    browserTimeZone.mockReturnValue('Asia/Tokyo')
    fetchTraceability.mockResolvedValue({ ...record, timeZone: 'Asia/Tokyo' })

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    function localWrapper({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>
    }

    renderHook(() => useTraceabilityCalendar({ year: 2026 }), { wrapper: localWrapper })

    await waitFor(() =>
      expect(
        client.getQueryData(dashboardKeys.traceability(2026, 'all', 'Asia/Tokyo')),
      ).toEqual({ ...record, timeZone: 'Asia/Tokyo' }),
    )
  })
})
