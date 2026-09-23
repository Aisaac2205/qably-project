import { render, screen, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { KpiRow } from '@/features/dashboard/components/kpi-row'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery, createTestQueryClient } from '@/lib/query-test-utils'
import { dashboardSummaryFixture } from '@/test/dashboard-api-stub'
import { dashboardKeys } from '@/features/dashboard/lib/query-keys'
import { getDashboardSummary } from '@/features/dashboard/api/dashboard.api'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

vi.mock('@/features/dashboard/api/dashboard.api', () => ({
  getDashboardSummary: vi.fn(),
  getTraceabilityCalendar: vi.fn(),
}))

const getSummary = vi.mocked(getDashboardSummary)

describe('KpiRow', () => {
  beforeEach(() => {
    __resetStore()
    getSummary.mockResolvedValue(dashboardSummaryFixture)
  })

  it('renders exactly four cards, drops the pass-rate card, and shows the defects KPI with its locked copy', async () => {
    await act(async () => {
      renderWithQuery(<KpiRow />)
    })
    expect(screen.getByText('Runs · 7d')).toBeInTheDocument()
    expect(screen.getByText('Failed test cases · 7d')).toBeInTheDocument()
    expect(screen.getByText('Pending AI')).toBeInTheDocument()
    expect(screen.getByText('Active runs')).toBeInTheDocument()
    expect(screen.queryByText('Pass rate · 7d')).not.toBeInTheDocument()
    expect(screen.queryByText('Coverage Gaps')).not.toBeInTheDocument()

    const grid = screen.getByLabelText('Quality overview').querySelector('dl')
    expect(grid?.children).toHaveLength(4)
    expect(
      screen.getByText('Failed test cases · 7d').closest('a'),
    ).toHaveTextContent(String(dashboardSummaryFixture.defectsDetected))
  })

  it('reads the run counts from the dashboard summary', async () => {
    await act(async () => {
      renderWithQuery(<KpiRow />)
    })
    expect(screen.getByText(String(dashboardSummaryFixture.runsInWindow))).toBeInTheDocument()
    expect(screen.getByText('Active runs').closest('a')).toHaveTextContent(
      String(dashboardSummaryFixture.activeRuns),
    )
  })

  it('counts pending proposals from the review list the inbox uses', async () => {
    await act(async () => {
      renderWithQuery(<KpiRow />)
    })
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('draws a defects sparkline from the recent runs, coloured fail when defects exist', async () => {
    await act(async () => {
      renderWithQuery(<KpiRow />)
    })

    const defectsCard = screen.getByText('Failed test cases · 7d').closest('a') as HTMLElement
    expect(dashboardSummaryFixture.recentRuns.length).toBeGreaterThanOrEqual(2)

    const chartRoot = defectsCard.querySelector('[data-slot="chart"]')
    expect(chartRoot).not.toBeNull()
    expect(chartRoot?.querySelector('.recharts-area-curve')).toHaveAttribute('stroke', 'var(--color-value)')
    expect(chartRoot?.querySelector('style')?.innerHTML).toContain('--color-value: var(--qb-chart-fail);')
  })

  it('lays the cards out two per row on a phone and four on a wide container', async () => {
    await act(async () => {
      renderWithQuery(<KpiRow />)
    })
    const grid = screen.getByLabelText('Quality overview').querySelector('dl')
    expect(grid).toHaveClass('grid-cols-2')
    expect(grid).toHaveClass('@2xl:grid-cols-4')
  })

  it('shows four skeletons in one row while the summary loads, never a zero or empty card', async () => {
    getSummary.mockReturnValue(new Promise(() => {}))
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.summary('all') })

    const { container } = render(
      <QueryClientProvider client={client}>
        <KpiRow />
      </QueryClientProvider>,
    )

    expect(screen.queryByText('Runs · 7d')).not.toBeInTheDocument()
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    const grid = screen.getByLabelText('Quality overview').querySelector('dl')
    expect(grid?.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(4)
    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(4)
  })

  it('shows one error card with a retry action wired to the summary query when it fails', async () => {
    getSummary.mockRejectedValue(new Error('network down'))
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.summary('all') })

    render(
      <QueryClientProvider client={client}>
        <KpiRow />
      </QueryClientProvider>,
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(screen.queryByText('Runs · 7d')).not.toBeInTheDocument()

    getSummary.mockResolvedValueOnce(dashboardSummaryFixture)
    const retryButton = screen.getByRole('button', { name: 'Retry' })
    await act(async () => {
      retryButton.click()
    })

    await waitFor(() => expect(screen.getByText('Runs · 7d')).toBeInTheDocument())
  })
})
