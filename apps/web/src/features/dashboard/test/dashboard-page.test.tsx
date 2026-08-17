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

  it('renders the dashboard heading', async () => {
    await act(async () => {
      render(<DashboardPage />)
    })
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('renders a focused operational introduction without decorative emoji', async () => {
    await act(async () => {
      render(<DashboardPage />)
    })
    expect(screen.getByText(/Acme QA Team/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.queryByText(/👋/)).not.toBeInTheDocument()
  })

  it('groups the quality metrics in one labelled summary strip', async () => {
    await act(async () => {
      render(<DashboardPage />)
    })
    const summary = screen.getByLabelText('Quality overview')
    expect(summary).toBeInTheDocument()
    expect(summary).toHaveTextContent('Projects')
    expect(summary).toHaveTextContent('Test Suites')
    expect(summary).toHaveTextContent('Runs (7d)')
    expect(summary).toHaveTextContent('Pass Rate (7d)')
    expect(summary).toHaveTextContent('Pending AI')
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

  it('heading has the correct typography class', async () => {
    await act(async () => {
      render(<DashboardPage />)
    })
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent('Dashboard')
    expect(heading.className).toContain('text-2xl')
    expect(heading.className).toContain('font-semibold')
    expect(heading.className).toContain('tracking-[-0.025em]')
  })
})
