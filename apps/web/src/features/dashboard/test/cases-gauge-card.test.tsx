import { render, screen, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery, createTestQueryClient } from '@/lib/query-test-utils'
import { dashboardKeys } from '@/features/dashboard/lib/query-keys'
import { dashboardOverviewFixture } from '@/test/dashboard-api-stub'
import { getDashboardOverview } from '@/features/dashboard/api/dashboard.api'
import { getBrowserTimeZone } from '@/lib/time-zone'
import { CasesGaugeCard } from '@/features/dashboard/components/cases-gauge-card'

vi.mock('@/features/dashboard/api/dashboard.api', () => ({
  getDashboardOverview: vi.fn(),
}))

const getOverview = vi.mocked(getDashboardOverview)

describe('CasesGaugeCard', () => {
  beforeEach(() => {
    __resetStore()
    getOverview.mockResolvedValue(dashboardOverviewFixture)
  })

  it('renders a gauge with the decided pass rate of the cases in scope', async () => {
    await act(async () => {
      renderWithQuery(<CasesGaugeCard period={30} />)
    })

    // 98 / (98 + 12 + 5) = 85.2% -> rounds to 85
    const meter = screen.getByRole('meter')
    expect(meter).toHaveAttribute('aria-valuenow', '85')
  })

  it('shows passed of total plus the failed, skipped and blocked counts', async () => {
    await act(async () => {
      renderWithQuery(<CasesGaugeCard period={30} />)
    })

    expect(screen.getByText('98/120 passed')).toBeInTheDocument()
    expect(screen.getByTestId('cases-failed')).toHaveTextContent('12')
    expect(screen.getByTestId('cases-skipped')).toHaveTextContent('5')
    expect(screen.getByTestId('cases-blocked')).toHaveTextContent('5')
  })

  it('shows a loading state while the overview loads', async () => {
    getOverview.mockReturnValue(new Promise(() => {}))
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.overview(30, 'all', getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <CasesGaugeCard period={30} />
      </QueryClientProvider>,
    )

    expect(screen.queryByRole('meter')).not.toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
  })

  it('shows an error state with retry when the overview fails', async () => {
    getOverview.mockRejectedValue(new Error('network down'))
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.overview(30, 'all', getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <CasesGaugeCard period={30} />
      </QueryClientProvider>,
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()

    getOverview.mockResolvedValueOnce(dashboardOverviewFixture)
    const retryButton = screen.getByRole('button', { name: 'Retry' })
    await act(async () => {
      retryButton.click()
    })

    await waitFor(() => expect(screen.getByRole('meter')).toBeInTheDocument())
  })

  it('shows an empty state when there are no decided cases', async () => {
    getOverview.mockResolvedValue({
      ...dashboardOverviewFixture,
      casesPassing: { total: 0, pending: 0, running: 0, pass: 0, fail: 0, skip: 0, blocked: 0 },
    })
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.overview(30, 'all', getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <CasesGaugeCard period={30} />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('No cases recorded yet')).toBeInTheDocument()
    expect(screen.queryByRole('meter')).not.toBeInTheDocument()
  })
})
