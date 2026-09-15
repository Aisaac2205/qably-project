import { render, screen, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery, createTestQueryClient } from '@/lib/query-test-utils'
import { dashboardKeys } from '@/features/dashboard/lib/query-keys'
import { dashboardSummaryFixture } from '@/test/dashboard-api-stub'
import { getDashboardSummary } from '@/features/dashboard/api/dashboard.api'
import { PassRateTrend } from '@/features/dashboard/components/pass-rate-trend'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

vi.mock('@/features/dashboard/api/dashboard.api', () => ({
  getDashboardSummary: vi.fn(),
  getTraceabilityCalendar: vi.fn(),
}))

const getSummary = vi.mocked(getDashboardSummary)

describe('PassRateTrend', () => {
  beforeEach(() => {
    __resetStore()
    getSummary.mockResolvedValue(dashboardSummaryFixture)
  })

  it('renders the title "Pass rate trend"', async () => {
    await act(async () => {
      renderWithQuery(<PassRateTrend />)
    })
    expect(screen.getByText('Pass rate trend')).toBeInTheDocument()
  })

  it('leads with the windowed pass rate the summary endpoint reports', async () => {
    await act(async () => {
      renderWithQuery(<PassRateTrend />)
    })
    const expected = `${Math.round(dashboardSummaryFixture.passRate * 100)}%`
    expect(screen.getAllByText(expected).length).toBeGreaterThanOrEqual(1)
  })

  it('signs the trend from the data instead of always pointing up', async () => {
    await act(async () => {
      renderWithQuery(<PassRateTrend />)
    })
    const trend = Math.round(dashboardSummaryFixture.passRateTrend * 100)
    expect(screen.getByText(`${trend > 0 ? '+' : ''}${trend}%`)).toBeInTheDocument()
    expect(screen.getByText('vs prior 7d')).toBeInTheDocument()
  })

  it('plots the recent runs the summary carries, not a hardcoded week', async () => {
    await act(async () => {
      renderWithQuery(<PassRateTrend />)
    })
    const runs = dashboardSummaryFixture.recentRuns.length
    expect(
      screen.getByRole('img', { name: `Pass rate of the last ${runs} runs` }),
    ).toBeInTheDocument()
    expect(screen.queryByText('May 8')).not.toBeInTheDocument()
  })

  it('states the window as text and offers no period selector it cannot honour', async () => {
    await act(async () => {
      renderWithQuery(<PassRateTrend />)
    })
    expect(screen.getByText('Last 7 days')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /select time period/i })).not.toBeInTheDocument()
  })

  it('shows a skeleton in the body while the summary loads, keeping the title visible', async () => {
    getSummary.mockReturnValue(new Promise(() => {}))
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.summary('all') })

    const { container } = render(
      <QueryClientProvider client={client}>
        <PassRateTrend />
      </QueryClientProvider>,
    )

    expect(screen.getByText('Pass rate trend')).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Pass rate of the last/i })).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
  })

  it('shows one error state with a retry action wired to the summary query when it fails', async () => {
    getSummary.mockRejectedValue(new Error('network down'))
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.summary('all') })

    render(
      <QueryClientProvider client={client}>
        <PassRateTrend />
      </QueryClientProvider>,
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /Pass rate of the last/i })).not.toBeInTheDocument()

    getSummary.mockResolvedValueOnce(dashboardSummaryFixture)
    const retryButton = screen.getByRole('button', { name: 'Retry' })
    await act(async () => {
      retryButton.click()
    })

    await waitFor(() =>
      expect(screen.getByRole('img', { name: /Pass rate of the last/i })).toBeInTheDocument(),
    )
  })

  it('has no size override on the card title, matching the shared card-title scale', async () => {
    await act(async () => {
      renderWithQuery(<PassRateTrend />)
    })
    const title = screen.getByText('Pass rate trend')
    expect(title.className).not.toContain('text-sm')
  })
})
