import { screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KpiRow } from '@/features/dashboard/components/kpi-row'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery } from '@/lib/query-test-utils'
import { dashboardSummaryFixture } from '@/test/dashboard-api-stub'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('KpiRow', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders four cards, every one backed by the API', async () => {
    await act(async () => {
      renderWithQuery(<KpiRow />)
    })
    expect(screen.getByText('Runs · 7d')).toBeInTheDocument()
    expect(screen.getByText('Pass rate · 7d')).toBeInTheDocument()
    expect(screen.getByText('Pending AI')).toBeInTheDocument()
    expect(screen.getByText('Active runs')).toBeInTheDocument()
    expect(screen.queryByText('Coverage Gaps')).not.toBeInTheDocument()
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

  it('lays the cards out two per row on a phone and four on a wide container', async () => {
    await act(async () => {
      renderWithQuery(<KpiRow />)
    })
    const grid = screen.getByLabelText('Quality overview').querySelector('dl')
    expect(grid).toHaveClass('grid-cols-2')
    expect(grid).toHaveClass('@2xl:grid-cols-4')
  })
})
