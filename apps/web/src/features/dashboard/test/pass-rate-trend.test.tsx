import { screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery } from '@/lib/query-test-utils'
import { dashboardSummaryFixture } from '@/test/dashboard-api-stub'
import { PassRateTrend } from '@/features/dashboard/components/pass-rate-trend'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('PassRateTrend', () => {
  beforeEach(() => {
    __resetStore()
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
})
