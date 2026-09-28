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

  it('titles the section with an h2 under the page h1', async () => {
    await act(async () => {
      renderWithQuery(<CasesGaugeCard period={30} />)
    })

    expect(screen.getByRole('heading', { level: 2, name: 'Cases by priority' })).toBeInTheDocument()
  })

  it('renders a donut pie chart with 3 balanced priority rivals', async () => {
    await act(async () => {
      renderWithQuery(<CasesGaugeCard period={30} />)
    })

    const chart = screen.getByRole('img', { name: 'Case distribution by priority' })
    expect(chart).toBeInTheDocument()

    // 3 clean, direct rivals without (P0) codes
    expect(screen.getByText('Critical')).toBeInTheDocument()
    expect(screen.getByText('High priority')).toBeInTheDocument()
    expect(screen.getByText('Medium and low')).toBeInTheDocument()

    // Center shows total cases label
    expect(screen.getByText('Total cases')).toBeInTheDocument()
  })

  it('removes the redundant 3 stat boxes and passed-of-total text for a clean UI', async () => {
    await act(async () => {
      renderWithQuery(<CasesGaugeCard period={30} />)
    })

    expect(screen.queryByTestId('cases-failed')).not.toBeInTheDocument()
    expect(screen.queryByTestId('cases-skipped')).not.toBeInTheDocument()
    expect(screen.queryByTestId('cases-blocked')).not.toBeInTheDocument()
    expect(screen.queryByText('98/120 passed')).not.toBeInTheDocument()
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

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
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

    await waitFor(() => expect(screen.getByRole('img')).toBeInTheDocument())
  })

  it('shows an empty state when there are no cases recorded', async () => {
    getOverview.mockResolvedValue({
      ...dashboardOverviewFixture,
      casesPassing: { total: 0, pending: 0, running: 0, pass: 0, fail: 0, skip: 0, blocked: 0 },
      projects: [],
    })
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.overview(30, 'all', getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <CasesGaugeCard period={30} />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('No cases recorded yet')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
