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

    expect(screen.getByText('Executed cases')).toBeInTheDocument()
    expect(screen.getByText('75')).toBeInTheDocument()
    expect(screen.getByText('Runs')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('Failed cases')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('Runs with failures')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('renders trend badges for each metric', async () => {
    await act(async () => {
      renderWithQuery(<KpiStrip period={30} />)
    })

    const executedTile = screen.getByText('Executed cases').closest('[data-slot="card"]')
    expect(executedTile).toBeInTheDocument()
    expect(executedTile).toHaveTextContent('-16.7%')
  })

  it('renders a sparkline chart per KPI tile', async () => {
    const { container } = await act(async () => renderWithQuery(<KpiStrip period={30} />))
    const charts = container.querySelectorAll('svg')
    expect(charts.length).toBeGreaterThan(0)
  })

  it('lays the tiles out one per row on a narrow container, two columns by @xs width, four as it widens further', async () => {
    const { container } = await act(async () => renderWithQuery(<KpiStrip period={30} />))
    const grid = container.querySelector('.grid')
    expect(grid).toHaveClass('grid-cols-1')
    expect(grid).toHaveClass('@xs:grid-cols-2')
    expect(grid).toHaveClass('@2xl:grid-cols-4')
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

    expect(screen.queryByText('Executed cases')).not.toBeInTheDocument()
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
    expect(screen.queryByText('Executed cases')).not.toBeInTheDocument()

    getOverview.mockResolvedValueOnce(dashboardOverviewFixture)
    const retryButton = screen.getByRole('button', { name: 'Retry' })
    await act(async () => {
      retryButton.click()
    })

    await waitFor(() => expect(screen.getByText('Executed cases')).toBeInTheDocument())
  })

  it('shows an empty state instead of a wall of dashes when the period has zero runs', async () => {
    getOverview.mockResolvedValue({
      ...dashboardOverviewFixture,
      passRateSeries: {
        ...dashboardOverviewFixture.passRateSeries,
        current: dashboardOverviewFixture.passRateSeries.current.map((p) => ({ ...p, runs: 0 })),
        previous: dashboardOverviewFixture.passRateSeries.previous.map((p) => ({ ...p, runs: 0 })),
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
    expect(screen.queryByText('Executed cases')).not.toBeInTheDocument()
  })
})
