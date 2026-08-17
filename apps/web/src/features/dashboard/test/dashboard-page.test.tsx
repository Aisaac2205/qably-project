import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DashboardPage } from '@/features/dashboard/components/dashboard-page'
import { __resetStore } from '@/lib/mock-store'

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
      render(<DashboardPage />)
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
      render(<DashboardPage />)
    })
    expect(screen.getByRole('table', { name: 'Project health' })).toBeInTheDocument()
    // Should show all 4 projects
    expect(screen.getByText('Ecommerce App')).toBeInTheDocument()
    expect(screen.getByText('Mobile App')).toBeInTheDocument()
    expect(screen.getByText('API Backend')).toBeInTheDocument()
    expect(screen.getByText('Admin Panel')).toBeInTheDocument()
  })

  it('renders recent activity sections', async () => {
    await act(async () => {
      render(<DashboardPage />)
    })
    expect(screen.getByText('Recent runs')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Pending AI cases' })).toBeInTheDocument()
    expect(screen.getByText('Recent pipelines')).toBeInTheDocument()
  })

  it('does not end the workspace with a decorative operational footer', async () => {
    await act(async () => {
      render(<DashboardPage />)
    })

    expect(screen.queryByText('All systems operational')).not.toBeInTheDocument()
  })

  it('uses the available workspace width instead of capping the dashboard canvas', async () => {
    await act(async () => {
      render(<DashboardPage />)
    })

    const workspace = screen.getByRole('region', { name: 'Dashboard' })
    expect(workspace).toHaveClass('w-full')
    expect(workspace).not.toHaveClass('max-w-[1440px]')
  })

  it('renders governance pipeline section with live stages', async () => {
    await act(async () => {
      render(<DashboardPage />)
    })
    expect(screen.getByRole('heading', { name: 'Governance pipeline' })).toBeInTheDocument()
    expect(screen.getByText('SCM Ingestion')).toBeInTheDocument()
    expect(screen.getByText('AI Proposals')).toBeInTheDocument()
    expect(screen.getByText('Official Cases')).toBeInTheDocument()
    expect(screen.getByText('CI Executions')).toBeInTheDocument()
  })

  it('renders an honest empty state for quality & freshness risks when no signals exist', async () => {
    await act(async () => {
      render(<DashboardPage />)
    })
    expect(screen.getByRole('heading', { name: 'Quality & freshness risks' })).toBeInTheDocument()
    expect(screen.getByText('No active risk signals yet')).toBeInTheDocument()
  })
})
