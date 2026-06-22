import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { __resetStore } from '@/lib/mock-store'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

import { ProjectHealthTable } from '@/features/dashboard/components/project-health-table'

describe('ProjectHealthTable', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders the title "Project health"', async () => {
    await act(async () => {
      render(<ProjectHealthTable />)
    })
    expect(screen.getByText('Project health')).toBeInTheDocument()
  })

  it('renders the "View all" link', async () => {
    await act(async () => {
      render(<ProjectHealthTable />)
    })
    const link = screen.getByText('View all')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/projects')
  })

  it('renders table headers', async () => {
    await act(async () => {
      render(<ProjectHealthTable />)
    })
    expect(screen.getByText('Project')).toBeInTheDocument()
    expect(screen.getByText('Health')).toBeInTheDocument()
    expect(screen.getByText('Last run')).toBeInTheDocument()
    expect(screen.getByText('Suites')).toBeInTheDocument()
    expect(screen.getByText('AI pending')).toBeInTheDocument()
  })

  it('renders all 4 projects from mock data', async () => {
    await act(async () => {
      render(<ProjectHealthTable />)
    })
    expect(screen.getByText('Ecommerce App')).toBeInTheDocument()
    expect(screen.getByText('Mobile App')).toBeInTheDocument()
    expect(screen.getByText('API Backend')).toBeInTheDocument()
    expect(screen.getByText('Admin Panel')).toBeInTheDocument()
  })

  it('renders project health scores', async () => {
    await act(async () => {
      render(<ProjectHealthTable />)
    })
    expect(screen.getByText('90%')).toBeInTheDocument()
    expect(screen.getByText('45%')).toBeInTheDocument()
    expect(screen.getByText('88%')).toBeInTheDocument()
    expect(screen.getByText('72%')).toBeInTheDocument()
  })

  it('renders project links pointing to correct URLs', async () => {
    await act(async () => {
      render(<ProjectHealthTable />)
    })
    const ecommerceLink = screen.getByText('Ecommerce App').closest('a')
    expect(ecommerceLink).toHaveAttribute('href', '/projects/proj-1')
    const mobileLink = screen.getByText('Mobile App').closest('a')
    expect(mobileLink).toHaveAttribute('href', '/projects/proj-2')
  })
})
