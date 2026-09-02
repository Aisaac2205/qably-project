import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery } from '@/lib/query-test-utils'
import { projectKeys } from '@/features/projects/lib/query-keys'
import { runKeys } from '@/features/runs/lib/query-keys'
import { projectFixtures } from '@/test/projects-api-stub'

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
      renderWithQuery(<ProjectHealthTable />)
    })
    expect(screen.getByRole('heading', { name: 'Project health' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Project health' })).toBeInTheDocument()
  })

  it('renders the "View all" link', async () => {
    await act(async () => {
      renderWithQuery(<ProjectHealthTable />)
    })
    const link = screen.getByText('View all')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/projects')
  })

  it('renders table headers', async () => {
    await act(async () => {
      renderWithQuery(<ProjectHealthTable />)
    })
    expect(screen.getByText('Project')).toBeInTheDocument()
    expect(screen.getByText('Health')).toBeInTheDocument()
    expect(screen.getByText('Last run')).toBeInTheDocument()
    expect(screen.getByText('Suites')).toBeInTheDocument()
    expect(screen.getByText('AI pending')).toBeInTheDocument()
  })

  it('renders all 4 projects from the api', async () => {
    await act(async () => {
      renderWithQuery(<ProjectHealthTable />)
    })
    expect(screen.getByText('Ecommerce App')).toBeInTheDocument()
    expect(screen.getByText('Mobile App')).toBeInTheDocument()
    expect(screen.getByText('API Backend')).toBeInTheDocument()
    expect(screen.getByText('Admin Panel')).toBeInTheDocument()
  })

  it('says runs are not measured yet instead of inventing a health score', async () => {
    await act(async () => {
      renderWithQuery(<ProjectHealthTable />)
    })
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
    expect(screen.getAllByText('No runs yet').length).toBeGreaterThan(0)
  })

  it('renders project links pointing to correct URLs', async () => {
    await act(async () => {
      renderWithQuery(<ProjectHealthTable />)
    })
    const ecommerceLink = screen.getByText('Ecommerce App').closest('a')
    expect(ecommerceLink).toHaveAttribute('href', '/projects/proj-1')
    const mobileLink = screen.getByText('Mobile App').closest('a')
    expect(mobileLink).toHaveAttribute('href', '/projects/proj-2')
  })

  it('renders the health score once the api reports run activity', async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    client.setQueryData(projectKeys.all, [
      {
        ...projectFixtures[0],
        activity: {
          healthScore: 90,
          lastRunStatus: 'pass',
          lastRunAt: '2026-06-16T10:00:00Z',
          activeRunCount: 0,
          aiPendingCount: 3,
        },
      },
    ])
    client.setQueryData(runKeys.list('all'), [])

    await act(async () => {
      render(
        <QueryClientProvider client={client}>
          <ProjectHealthTable />
        </QueryClientProvider>,
      )
    })

    expect(screen.getByText('90%')).toBeInTheDocument()
  })
})
