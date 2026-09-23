import { render, screen, act, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'

// jsdom doesn't implement matchMedia. ComparisonAreaChart uses it via
// useCoarsePointer to pick the hover/click tooltip trigger.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery, createTestQueryClient } from '@/lib/query-test-utils'
import { dashboardKeys } from '@/features/dashboard/lib/query-keys'
import { dashboardOverviewFixture } from '@/test/dashboard-api-stub'
import { getDashboardOverview } from '@/features/dashboard/api/dashboard.api'
import { getBrowserTimeZone } from '@/lib/time-zone'
import { PassRateHero } from '@/features/dashboard/components/pass-rate-hero'

vi.mock('@/features/dashboard/api/dashboard.api', () => ({
  getDashboardOverview: vi.fn(),
}))

const getOverview = vi.mocked(getDashboardOverview)

// apps/web's global setup polyfills ResizeObserver for resizable-split.tsx.
// Recharts 3.8.1's ResponsiveContainer only honours ChartContainer's
// initialDimension fallback when ResizeObserver is undefined — with the
// global polyfill present it instead tries to measure the real (0x0 in
// jsdom) container and renders nothing. Undefine it locally so the hero
// chart's SVG actually renders in this suite (packages/ui's own tests never
// see this because their setup has no such polyfill).
const originalResizeObserver = globalThis.ResizeObserver

describe('PassRateHero', () => {
  beforeEach(() => {
    __resetStore()
    getOverview.mockResolvedValue(dashboardOverviewFixture)
    // @ts-expect-error -- intentionally undefined for this suite, see comment above
    delete globalThis.ResizeObserver
  })

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver
  })

  it('renders the hero title and a sr-only table mirroring the current/previous series', async () => {
    await act(async () => {
      renderWithQuery(<PassRateHero period={30} />)
    })

    expect(screen.getByRole('heading', { level: 2, name: 'Pass rate' })).toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Pass rate comparison chart' })
    expect(table).toBeInTheDocument()
    expect(within(table).getAllByText('Current period').length).toBeGreaterThan(0)
    expect(within(table).getAllByText('Previous period').length).toBeGreaterThan(0)
  })

  it('exposes the chart as a keyboard-focusable, accessible element', async () => {
    await act(async () => {
      renderWithQuery(<PassRateHero period={30} />)
    })

    const svg = document.querySelector('svg.recharts-surface[tabindex="0"]')
    expect(svg).not.toBeNull()
  })

  it('caps content width with the dashboard token, never an arbitrary value', async () => {
    const { container } = await act(async () => renderWithQuery(<PassRateHero period={30} />))
    expect(container.querySelector('.max-w-dashboard')).toBeInTheDocument()
    expect(container.innerHTML).not.toContain('max-w-[1128px]')
  })

  it('shows a skeleton while the overview loads, keeping the title visible', async () => {
    getOverview.mockReturnValue(new Promise(() => {}))
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.overview(30, 'all', getBrowserTimeZone()) })

    const { container } = render(
      <QueryClientProvider client={client}>
        <PassRateHero period={30} />
      </QueryClientProvider>,
    )

    expect(screen.getByText('Pass rate')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
  })

  it('shows one error state with a retry action wired to the overview query when it fails', async () => {
    getOverview.mockRejectedValue(new Error('network down'))
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.overview(30, 'all', getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <PassRateHero period={30} />
      </QueryClientProvider>,
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    getOverview.mockResolvedValueOnce(dashboardOverviewFixture)
    const retryButton = screen.getByRole('button', { name: 'Retry' })
    await act(async () => {
      retryButton.click()
    })

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
  })
})
