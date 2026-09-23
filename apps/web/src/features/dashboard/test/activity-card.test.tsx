import { render, screen, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery, createTestQueryClient } from '@/lib/query-test-utils'
import { dashboardKeys } from '@/features/dashboard/lib/query-keys'
import { dashboardOverviewFixture } from '@/test/dashboard-api-stub'
import { getDashboardOverview } from '@/features/dashboard/api/dashboard.api'
import { getBrowserTimeZone } from '@/lib/time-zone'
import { ActivityCard } from '@/features/dashboard/components/activity-card'

vi.mock('@/features/dashboard/api/dashboard.api', () => ({
  getDashboardOverview: vi.fn(),
}))

const getOverview = vi.mocked(getDashboardOverview)

describe('ActivityCard', () => {
  beforeEach(() => {
    __resetStore()
    getOverview.mockResolvedValue(dashboardOverviewFixture)
  })

  it('titles the section with an h2 under the page h1', async () => {
    await act(async () => {
      renderWithQuery(<ActivityCard period={30} />)
    })

    expect(screen.getByRole('heading', { level: 2, name: 'Recent activity' })).toBeInTheDocument()
  })

  it('renders the recent activity entries in the order the server returns', async () => {
    await act(async () => {
      renderWithQuery(<ActivityCard period={30} />)
    })

    expect(screen.getByText('Checkout Web')).toBeInTheDocument()
    expect(screen.getByText('Mobile App · Auth smoke')).toBeInTheDocument()
  })

  it('shows a loading state while the overview loads', async () => {
    getOverview.mockReturnValue(new Promise(() => {}))
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.overview(30, 'all', getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <ActivityCard period={30} />
      </QueryClientProvider>,
    )

    expect(screen.queryByText('Checkout Web')).not.toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
  })

  it('shows an error state with retry when the overview fails', async () => {
    getOverview.mockRejectedValue(new Error('network down'))
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.overview(30, 'all', getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <ActivityCard period={30} />
      </QueryClientProvider>,
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()

    getOverview.mockResolvedValueOnce(dashboardOverviewFixture)
    const retryButton = screen.getByRole('button', { name: 'Retry' })
    await act(async () => {
      retryButton.click()
    })

    await waitFor(() => expect(screen.getByText('Checkout Web')).toBeInTheDocument())
  })

  it('shows an empty state when there is no recent activity', async () => {
    getOverview.mockResolvedValue({ ...dashboardOverviewFixture, recentActivity: [] })
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.overview(30, 'all', getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <ActivityCard period={30} />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('No recent activity')).toBeInTheDocument()
  })
})
