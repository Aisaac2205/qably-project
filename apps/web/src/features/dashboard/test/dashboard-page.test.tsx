import { screen, act, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DashboardPage } from '@/features/dashboard/components/dashboard-page'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery } from '@/lib/query-test-utils'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('DashboardPage', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('groups the quality metrics in one labelled summary strip', async () => {
    await act(async () => {
      renderWithQuery(<DashboardPage />)
    })
    const summary = screen.getByLabelText('Quality overview')
    expect(summary).toBeInTheDocument()
    expect(summary).toHaveTextContent('Runs')
    expect(summary).toHaveTextContent('Pass Rate')
    expect(summary).toHaveTextContent('Pending AI')
    expect(summary).toHaveTextContent('Coverage Gaps')
  })

  it('renders project health section', async () => {
    await act(async () => {
      renderWithQuery(<DashboardPage />)
    })
    const table = screen.getByRole('table', { name: 'Project health' })
    expect(table).toBeInTheDocument()
    // Should show all 4 projects
    expect(within(table).getByText('Ecommerce App')).toBeInTheDocument()
    expect(within(table).getByText('Mobile App')).toBeInTheDocument()
    expect(within(table).getByText('API Backend')).toBeInTheDocument()
    expect(within(table).getByText('Admin Panel')).toBeInTheDocument()
  })

  it('renders recent activity sections', async () => {
    await act(async () => {
      renderWithQuery(<DashboardPage />)
    })
    expect(screen.getByText('Recent runs')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pending proposals' })).toBeInTheDocument()
    expect(screen.getByText('Recent pipelines')).toBeInTheDocument()
  })

  it('does not end the workspace with a decorative operational footer', async () => {
    await act(async () => {
      renderWithQuery(<DashboardPage />)
    })

    expect(screen.queryByText('All systems operational')).not.toBeInTheDocument()
  })

  it('uses the available workspace width instead of capping the dashboard canvas', async () => {
    await act(async () => {
      renderWithQuery(<DashboardPage />)
    })

    const workspace = screen.getByRole('region', { name: 'Dashboard' })
    expect(workspace).toHaveClass('w-full')
    expect(workspace).not.toHaveClass('max-w-[1440px]')
  })

  it('renders governance pipeline section with live stages', async () => {
    await act(async () => {
      renderWithQuery(<DashboardPage />)
    })
    expect(screen.getByRole('heading', { name: 'Governance pipeline' })).toBeInTheDocument()
  })

  it('renders quality & freshness risks section with active signals', async () => {
    await act(async () => {
      renderWithQuery(<DashboardPage />)
    })
    expect(screen.getByRole('heading', { name: 'Quality & freshness risks' })).toBeInTheDocument()
    expect(screen.getByText(/coverage gap in payment refunds flow/i)).toBeInTheDocument()
  })
})
