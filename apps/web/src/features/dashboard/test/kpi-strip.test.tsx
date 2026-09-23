import { render, screen, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery, createTestQueryClient } from '@/lib/query-test-utils'
import { dashboardKeys } from '@/features/dashboard/lib/query-keys'
import { dashboardOverviewFixture } from '@/test/dashboard-api-stub'
import { getDashboardOverview } from '@/features/dashboard/api/dashboard.api'
import { getBrowserTimeZone } from '@/lib/time-zone'
import { KpiStrip } from '@/features/dashboard/components/kpi-strip'

vi.mock('@/features/dashboard/api/dashboard.api', () => ({
  getDashboardOverview: vi.fn(),
}))

const getOverview = vi.mocked(getDashboardOverview)

describe('KpiStrip', () => {
  beforeEach(() => {
    __resetStore()
    getOverview.mockResolvedValue(dashboardOverviewFixture)
  })

  it('renders the four KPI tiles with the values the overview reports', async () => {
    await act(async () => {
      renderWithQuery(<KpiStrip period={30} />)
    })

    expect(screen.getByText('Pass rate')).toBeInTheDocument()
    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(screen.getByText('Runs')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Failed cases')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('Avg run duration')).toBeInTheDocument()
    expect(screen.getByText('3m 4s')).toBeInTheDocument()
  })

  it('styles fewer failed cases as a positive delta and more runs as positive too', async () => {
    await act(async () => {
      renderWithQuery(<KpiStrip period={30} />)
    })

    // failedCases: 6 vs previous 9 -> fewer failures is good ("better" tone)
    const failedDelta = screen.getByText('↓ 3')
    expect(failedDelta.className).toContain('text-qb-pass')

    // runs: 42 vs previous 35 -> more runs is good ("better" tone)
    const runsDelta = screen.getByText('↑ 7')
    expect(runsDelta.className).toContain('text-qb-pass')
  })

  it('draws a sparkline per KPI with an accessible trend label', async () => {
    await act(async () => {
      renderWithQuery(<KpiStrip period={30} />)
    })

    expect(screen.getByRole('img', { name: 'Pass rate trend over the selected period' })).toBeInTheDocument()
  })

  it('lays the tiles out one per row on a narrow container, two columns by 390px width, four as it widens further', async () => {
    await act(async () => {
      renderWithQuery(<KpiStrip period={30} />)
    })
    const dl = document.querySelector('dl')
    expect(dl).toHaveClass('grid-cols-1')
    expect(dl).toHaveClass('@xs:grid-cols-2')
    expect(dl).toHaveClass('@2xl:grid-cols-4')
    expect(dl).not.toHaveClass('@md:grid-cols-2')
  })

  it('caps content width with the dashboard token, never an arbitrary value', async () => {
    const { container } = await act(async () => renderWithQuery(<KpiStrip period={30} />))
    expect(container.querySelector('.max-w-dashboard')).toBeInTheDocument()
    expect(container.innerHTML).not.toContain('max-w-[1128px]')
  })

  it('shows four skeletons while the overview loads', async () => {
    getOverview.mockReturnValue(new Promise(() => {}))
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.overview(30, 'all', getBrowserTimeZone()) })

    const { container } = render(
      <QueryClientProvider client={client}>
        <KpiStrip period={30} />
      </QueryClientProvider>,
    )

    expect(screen.queryByText('Pass rate')).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(4)
  })

  it('shows one error state with a retry action wired to the overview query when it fails', async () => {
    getOverview.mockRejectedValue(new Error('network down'))
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.overview(30, 'all', getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <KpiStrip period={30} />
      </QueryClientProvider>,
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(screen.queryByText('Pass rate')).not.toBeInTheDocument()

    getOverview.mockResolvedValueOnce(dashboardOverviewFixture)
    const retryButton = screen.getByRole('button', { name: 'Retry' })
    await act(async () => {
      retryButton.click()
    })

    await waitFor(() => expect(screen.getByText('Pass rate')).toBeInTheDocument())
  })

  it('shows an empty state instead of a wall of dashes when the period has zero runs', async () => {
    getOverview.mockResolvedValue({
      ...dashboardOverviewFixture,
      kpis: {
        ...dashboardOverviewFixture.kpis,
        runs: { value: 0, previous: 0, series: [null, null, null, null] },
      },
    })
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.overview(30, 'all', getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <KpiStrip period={30} />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('No runs recorded for the selected period')).toBeInTheDocument()
    expect(screen.queryByText('Pass rate')).not.toBeInTheDocument()
  })
})
