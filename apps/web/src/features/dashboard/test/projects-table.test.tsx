import { render, screen, act, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery, createTestQueryClient } from '@/lib/query-test-utils'
import { dashboardKeys } from '@/features/dashboard/lib/query-keys'
import { dashboardOverviewFixture } from '@/test/dashboard-api-stub'
import { getDashboardOverview } from '@/features/dashboard/api/dashboard.api'
import { getBrowserTimeZone } from '@/lib/time-zone'
import { ProjectsTable } from '@/features/dashboard/components/projects-table'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

vi.mock('@/features/dashboard/api/dashboard.api', () => ({
  getDashboardOverview: vi.fn(),
}))

const getOverview = vi.mocked(getDashboardOverview)

describe('ProjectsTable', () => {
  beforeEach(() => {
    __resetStore()
    getOverview.mockResolvedValue(dashboardOverviewFixture)
  })

  it('sorts rows ascending by pass rate, with null pass rates last', async () => {
    await act(async () => {
      renderWithQuery(<ProjectsTable period={30} />)
    })

    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    const names = rows.map((row) => within(row).getByRole('link').textContent)

    expect(names).toEqual(['Mobile App', 'Checkout Web', 'Internal Tools'])
  })

  it('shows suites, cases and a formatted pass rate per row', async () => {
    await act(async () => {
      renderWithQuery(<ProjectsTable period={30} />)
    })

    const table = screen.getByRole('table')
    const row = within(table).getByRole('link', { name: 'Checkout Web' }).closest('tr')
    expect(row).not.toBeNull()
    expect(within(row as HTMLElement).getByText('3')).toBeInTheDocument()
    expect(within(row as HTMLElement).getByText('40')).toBeInTheDocument()
    expect(within(row as HTMLElement).getByText('82%')).toBeInTheDocument()
    expect(within(row as HTMLElement).getByRole('meter')).toBeInTheDocument()
  })

  it('shows a dash for a project that has never run', async () => {
    await act(async () => {
      renderWithQuery(<ProjectsTable period={30} />)
    })

    const table = screen.getByRole('table')
    const row = within(table).getByRole('link', { name: 'Internal Tools' }).closest('tr')
    expect(within(row as HTMLElement).getByText('No runs yet')).toBeInTheDocument()
  })

  it('wraps the table in a keyboard-focusable scroll region so it never overflows the page', async () => {
    await act(async () => {
      renderWithQuery(<ProjectsTable period={30} />)
    })

    const region = screen.getByRole('region', { name: 'Projects table, scrollable' })
    expect(region).toHaveAttribute('tabindex', '0')
    expect(region).toHaveClass('overflow-x-auto')
    expect(region.querySelector('table')).not.toBeNull()
  })

  it('shows a loading state while the overview loads', async () => {
    getOverview.mockReturnValue(new Promise(() => {}))
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.overview(30, 'all', getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <ProjectsTable period={30} />
      </QueryClientProvider>,
    )

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
  })

  it('shows an error state with retry when the overview fails', async () => {
    getOverview.mockRejectedValue(new Error('network down'))
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.overview(30, 'all', getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <ProjectsTable period={30} />
      </QueryClientProvider>,
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()

    getOverview.mockResolvedValueOnce(dashboardOverviewFixture)
    const retryButton = screen.getByRole('button', { name: 'Retry' })
    await act(async () => {
      retryButton.click()
    })

    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument())
  })

  it('shows an empty state when there are no projects in scope', async () => {
    getOverview.mockResolvedValue({ ...dashboardOverviewFixture, projects: [] })
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.overview(30, 'all', getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <ProjectsTable period={30} />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('No projects yet')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
