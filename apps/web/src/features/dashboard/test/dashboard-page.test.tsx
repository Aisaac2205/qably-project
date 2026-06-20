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

  it('renders welcome message with org name', async () => {
    await act(async () => {
      render(<DashboardPage />)
    })
    expect(screen.getByText(/Welcome back/)).toBeInTheDocument()
    expect(screen.getByText(/Acme QA Team/)).toBeInTheDocument()
  })

  it('renders KPI cards', async () => {
    await act(async () => {
      render(<DashboardPage />)
    })
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Test Suites')).toBeInTheDocument()
    expect(screen.getByText('Runs (7d)')).toBeInTheDocument()
    expect(screen.getByText('Pass Rate (7d)')).toBeInTheDocument()
    expect(screen.getByText('Pending AI')).toBeInTheDocument()
  })

  it('renders project health section', async () => {
    await act(async () => {
      render(<DashboardPage />)
    })
    expect(screen.getByText('Project health')).toBeInTheDocument()
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
    expect(screen.getByText('Pending AI cases')).toBeInTheDocument()
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
    expect(heading.className).toContain('tracking-tight')
  })
})
