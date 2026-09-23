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

  it('titles the section with an h2 under the page h1', async () => {
    await act(async () => {
      renderWithQuery(<ProjectsTable period={30} />)
    })

    expect(screen.getByRole('heading', { level: 2, name: 'Projects' })).toBeInTheDocument()
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

  it('drops the separate Last run column and shows the relative time under the project name instead', async () => {
    await act(async () => {
      renderWithQuery(<ProjectsTable period={30} />)
    })

    const table = screen.getByRole('table')
    expect(within(table).queryByRole('columnheader', { name: 'Last run' })).not.toBeInTheDocument()

    const row = within(table).getByRole('link', { name: 'Checkout Web' }).closest('tr') as HTMLElement
    expect(within(row).getByText(/Last run/)).toBeInTheDocument()
  })

  it('renders the pass-rate bar before the mono value, right-aligned', async () => {
    await act(async () => {
      renderWithQuery(<ProjectsTable period={30} />)
    })

    const table = screen.getByRole('table')
    const row = within(table).getByRole('link', { name: 'Checkout Web' }).closest('tr') as HTMLElement
    const meter = within(row).getByRole('meter')
    const value = within(row).getByText('82%')

    expect(meter.compareDocumentPosition(value) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('gives the project column a minimum width so the pass-rate column stays reachable on a narrow scroll', async () => {
    await act(async () => {
      renderWithQuery(<ProjectsTable period={30} />)
    })

    const table = screen.getByRole('table')
    const cell = within(table).getByRole('link', { name: 'Checkout Web' }).closest('td')
    expect(cell?.className).toMatch(/min-w-/)
  })

  it('never wraps the table in a scrolling region', async () => {
    await act(async () => {
      renderWithQuery(<ProjectsTable period={30} />)
    })

    const table = screen.getByRole('table')
    expect(table).toHaveClass('table-fixed')
    expect(table.className).not.toMatch(/min-w-xl/)
    expect(table.closest('[tabindex]')).toBeNull()
    expect(table.closest('.overflow-x-auto')).toBeNull()
  })

  it('hides the Suites and Cases columns below the @lg container width, header and data cells together', async () => {
    await act(async () => {
      renderWithQuery(<ProjectsTable period={30} />)
    })

    const table = screen.getByRole('table')
    const suitesHeader = within(table).getByRole('columnheader', { name: 'Suites' })
    const casesHeader = within(table).getByRole('columnheader', { name: 'Cases' })
    expect(suitesHeader).toHaveClass('hidden', '@lg:table-cell')
    expect(casesHeader).toHaveClass('hidden', '@lg:table-cell')

    const row = within(table).getByRole('link', { name: 'Checkout Web' }).closest('tr') as HTMLElement
    const cells = within(row).getAllByRole('cell')
    expect(cells[1]).toHaveClass('hidden', '@lg:table-cell')
    expect(cells[2]).toHaveClass('hidden', '@lg:table-cell')
    expect(cells[0]).not.toHaveClass('hidden')
    expect(cells[3]).not.toHaveClass('hidden')
  })

  it('keeps every visible header paired with a visible data cell in each row', async () => {
    await act(async () => {
      renderWithQuery(<ProjectsTable period={30} />)
    })

    const table = screen.getByRole('table')
    const headers = within(table).getAllByRole('columnheader')
    const rows = within(table).getAllByRole('row').slice(1)

    rows.forEach((row) => {
      const cells = within(row).getAllByRole('cell')
      expect(cells).toHaveLength(headers.length)
      headers.forEach((header, index) => {
        expect(cells[index].className.includes('hidden')).toBe(header.className.includes('hidden'))
      })
    })
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
