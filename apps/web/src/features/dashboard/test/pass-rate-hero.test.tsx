import { render, screen, act, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'

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

const originalResizeObserver = globalThis.ResizeObserver

describe('PassRateHero', () => {
  beforeEach(() => {
    __resetStore()
    getOverview.mockResolvedValue(dashboardOverviewFixture)
    // @ts-expect-error test-only override
    delete globalThis.ResizeObserver
  })

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver
  })

  it('renders the "Executed cases" title with a period-range description', async () => {
    await act(async () => {
      renderWithQuery(<PassRateHero period={30} />)
    })

    expect(screen.getByRole('heading', { level: 2, name: 'Executed cases' })).toBeInTheDocument()
    const description = document.querySelector('[data-slot="card-description"]')
    expect(description).toBeInTheDocument()
    expect(description?.textContent).not.toBe('')
  })

  it('renders a sr-only table mirroring day, current, previous and that day\'s passed/failed/blocked counts', async () => {
    await act(async () => {
      renderWithQuery(<PassRateHero period={30} />)
    })

    const table = screen.getByRole('table', { name: 'Executed cases comparison chart' })
    expect(table).toBeInTheDocument()
    expect(within(table).getByText('Day')).toBeInTheDocument()
    expect(within(table).getAllByText('Current period').length).toBeGreaterThan(0)
    expect(within(table).getAllByText('Previous period').length).toBeGreaterThan(0)
    expect(within(table).getByText('Passed')).toBeInTheDocument()
    expect(within(table).getByText('Failed')).toBeInTheDocument()
    expect(within(table).getByText('Blocked')).toBeInTheDocument()
    expect(within(table).getByText('30')).toBeInTheDocument()
    expect(within(table).getByText('27')).toBeInTheDocument()
  })

  it('shows a sign-aware trend line in the footer, comparing total executed cases across the whole period', async () => {
    await act(async () => {
      renderWithQuery(<PassRateHero period={30} />)
    })

    expect(screen.getByText('17% fewer executed cases than the previous period')).toBeInTheDocument()
  })

  it('shows a period-aware muted subtitle line in the footer', async () => {
    await act(async () => {
      renderWithQuery(<PassRateHero period={30} />)
    })

    expect(screen.getByText('Executed cases over the last 30 days')).toBeInTheDocument()
  })

  it('reports no change, without a percent, when current and previous totals are equal', async () => {
    getOverview.mockResolvedValue({
      ...dashboardOverviewFixture,
      passRateSeries: {
        current: [{ date: '2026-06-16', passRate: 0.8, runs: 4, failedRuns: 1, executed: 10, passed: 8, failed: 1, blocked: 1 }],
        previous: [{ date: '2026-05-17', passRate: 0.8, runs: 4, failedRuns: 1, executed: 10, passed: 8, failed: 1, blocked: 1 }],
      },
    })
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.overview(30, 'all', getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <PassRateHero period={30} />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('No change in executed cases from the previous period')).toBeInTheDocument()
  })

  it('omits the percent sign when the previous period total is zero', async () => {
    getOverview.mockResolvedValue({
      ...dashboardOverviewFixture,
      passRateSeries: {
        current: [{ date: '2026-06-16', passRate: 1, runs: 4, failedRuns: 0, executed: 10, passed: 10, failed: 0, blocked: 0 }],
        previous: [{ date: '2026-05-17', passRate: null, runs: 0, failedRuns: 0, executed: 0, passed: 0, failed: 0, blocked: 0 }],
      },
    })
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.overview(30, 'all', getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <PassRateHero period={30} />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('More executed cases than the previous period')).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
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

  it('sizes the chart wrapper to a fixed 240px (h-60), per the mockup', async () => {
    const { container } = await act(async () => renderWithQuery(<PassRateHero period={30} />))
    expect(container.querySelector('.h-60')).toBeInTheDocument()
    expect(container.innerHTML).not.toContain('h-48')
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

    expect(screen.getByText('Executed cases')).toBeInTheDocument()
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
