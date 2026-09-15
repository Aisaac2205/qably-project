import { render, screen, act, within, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ProjectActivity, ProjectListItem } from '@qably/types'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery } from '@/lib/query-test-utils'
import { projectKeys } from '@/features/projects/lib/query-keys'
import { runKeys } from '@/features/runs/lib/query-keys'
import { projectFixtures } from '@/test/projects-api-stub'
import { useI18nStore } from '@/lib/i18n'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

import { ProjectStatusTable } from '@/features/dashboard/components/project-status-table'

function activity(overrides: Partial<ProjectActivity> = {}): ProjectActivity {
  return {
    healthScore: 90,
    lastRunStatus: 'pass',
    lastRunAt: '2026-06-16T10:00:00Z',
    activeRunCount: 0,
    ...overrides,
  }
}

async function renderWithProjects(projects: ProjectListItem[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  client.setQueryData(projectKeys.all, projects)
  client.setQueryData(runKeys.list('all'), [])

  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        <ProjectStatusTable />
      </QueryClientProvider>,
    )
  })
}

describe('ProjectStatusTable', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('is titled after the status it reports, not a health metaphor', async () => {
    await act(async () => {
      renderWithQuery(<ProjectStatusTable />)
    })

    expect(screen.getByRole('heading', { name: 'Project status' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Project status' })).toBeInTheDocument()
    expect(screen.queryByText(/health/i)).not.toBeInTheDocument()
  })

  it('names the percentage column after the metric it actually holds', async () => {
    await act(async () => {
      renderWithQuery(<ProjectStatusTable />)
    })

    expect(screen.getByText('Project')).toBeInTheDocument()
    expect(screen.getByText('Pass rate')).toBeInTheDocument()
    expect(screen.getByText('Last run')).toBeInTheDocument()
    expect(screen.getByText('Suites')).toBeInTheDocument()
  })

  it('renders the "View all" link', async () => {
    await act(async () => {
      renderWithQuery(<ProjectStatusTable />)
    })

    const link = screen.getByText('View all')
    expect(link.closest('a')).toHaveAttribute('href', '/projects')
  })

  it('lists every project the api returns', async () => {
    await act(async () => {
      renderWithQuery(<ProjectStatusTable />)
    })

    expect(screen.getByText('Ecommerce App')).toBeInTheDocument()
    expect(screen.getByText('Mobile App')).toBeInTheDocument()
    expect(screen.getByText('API Backend')).toBeInTheDocument()
    expect(screen.getByText('Admin Panel')).toBeInTheDocument()
  })

  it('puts the project that needs attention at the top', async () => {
    await renderWithProjects([
      { ...projectFixtures[0], name: 'Healthy', activity: activity({ healthScore: 100 }) },
      { ...projectFixtures[1], name: 'Never run', activity: null },
      {
        ...projectFixtures[2],
        name: 'Broken',
        activity: activity({ lastRunStatus: 'fail', healthScore: 40 }),
      },
    ])

    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('Broken')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Never run')).toBeInTheDocument()
  })

  it('hides the AI column while the Review/AI domain reports nothing', async () => {
    await renderWithProjects([
      { ...projectFixtures[0], activity: activity() },
    ])

    expect(screen.queryByText('AI pending')).not.toBeInTheDocument()
    expect(screen.queryByText('—')).not.toBeInTheDocument()
  })

  it('shows the AI column as soon as one project reports a pending count', async () => {
    await renderWithProjects([
      { ...projectFixtures[0], activity: activity({ aiPendingCount: 3 }) },
      { ...projectFixtures[1], activity: activity() },
    ])

    expect(screen.getByText('AI pending')).toBeInTheDocument()

    const [firstRow] = screen.getAllByRole('row').slice(1)
    const cells = within(firstRow).getAllByRole('cell')
    expect(cells[cells.length - 1]).toHaveTextContent('3')
  })

  it('reports the pass rate once the api measures run activity', async () => {
    await renderWithProjects([{ ...projectFixtures[0], activity: activity({ healthScore: 90 }) }])

    const [row] = screen.getAllByRole('row').slice(1)
    const cells = within(row).getAllByRole('cell')
    expect(cells[2]).toHaveTextContent('90%')
  })

  it('says the pass rate is not measured instead of showing 0% for an empty window', async () => {
    await renderWithProjects([
      { ...projectFixtures[0], activity: activity({ healthScore: null }) },
    ])

    const [row] = screen.getAllByRole('row').slice(1)
    const cells = within(row).getAllByRole('cell')
    expect(cells[2]).not.toHaveTextContent('%')
    expect(cells[2]).toHaveTextContent('Not measured yet')
  })

  it('says a project has never run instead of inventing a status', async () => {
    await renderWithProjects([{ ...projectFixtures[0], activity: null }])

    expect(screen.getAllByText('No runs yet').length).toBeGreaterThan(0)
  })

  it('pairs the last run status with when it ran', async () => {
    await renderWithProjects([
      {
        ...projectFixtures[0],
        activity: activity({
          lastRunStatus: 'fail',
          lastRunAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        }),
      },
    ])

    const [row] = screen.getAllByRole('row').slice(1)
    expect(within(row).getByLabelText('Fail')).toBeInTheDocument()
    expect(within(row).getByText('2h ago')).toBeInTheDocument()
  })

  it('renders the last run time in the active locale', async () => {
    useI18nStore.setState({ locale: 'es' })

    await renderWithProjects([
      {
        ...projectFixtures[0],
        activity: activity({
          lastRunAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        }),
      },
    ])

    expect(screen.getByText('hace 2 h')).toBeInTheDocument()
    expect(screen.queryByText(/ago/i)).not.toBeInTheDocument()
  })

  it('links each project row to its project page', async () => {
    await act(async () => {
      renderWithQuery(<ProjectStatusTable />)
    })

    expect(screen.getByText('Ecommerce App').closest('a')).toHaveAttribute(
      'href',
      '/projects/proj-1/repository',
    )
  })

  it('declares its own container context', async () => {
    await act(async () => {
      renderWithQuery(<ProjectStatusTable />)
    })

    const table = screen.getByRole('table', { name: 'Project status' })
    expect(table.closest('[data-slot="card"]')).toHaveClass('@container')
  })

  it('caps the visible rows and shows a count against the full org total', async () => {
    const projects = Array.from({ length: 9 }, (_, i) => ({
      ...projectFixtures[0],
      id: `p-${i}`,
      name: `Project ${i}`,
      activity: activity({ healthScore: 90 - i }),
    }))

    await renderWithProjects(projects)

    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(6)
    expect(screen.getByText('Showing 6 of 9')).toBeInTheDocument()
  })

  it('toggles aria-sort on the clicked column and reorders rows', async () => {
    await renderWithProjects([
      { ...projectFixtures[0], name: 'Zeta', activity: activity() },
      { ...projectFixtures[1], name: 'Alpha', activity: activity() },
    ])

    const nameHeader = screen.getByRole('columnheader', { name: 'Project' })
    expect(nameHeader).toHaveAttribute('aria-sort', 'none')

    const sortButton = screen.getByRole('button', { name: 'Sort by project' })
    await act(async () => {
      sortButton.click()
    })

    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending')
    let rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('Alpha')).toBeInTheDocument()

    await act(async () => {
      sortButton.click()
    })

    expect(nameHeader).toHaveAttribute('aria-sort', 'descending')
    rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('Zeta')).toBeInTheDocument()
  })

  it('makes the last-run column sortable too', async () => {
    await renderWithProjects([
      { ...projectFixtures[0], name: 'older', activity: activity({ lastRunAt: '2026-06-01T10:00:00Z' }) },
      { ...projectFixtures[1], name: 'newer', activity: activity({ lastRunAt: '2026-06-16T10:00:00Z' }) },
    ])

    const lastRunHeader = screen.getByRole('columnheader', { name: 'Last run' })
    expect(lastRunHeader).toHaveAttribute('aria-sort', 'none')

    const sortButton = screen.getByRole('button', { name: 'Sort by last run' })
    await act(async () => {
      sortButton.click()
    })

    expect(lastRunHeader).toHaveAttribute('aria-sort', 'ascending')
    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('older')).toBeInTheDocument()
  })

  it('filters by name across the full org list, surfacing a project outside the visible cap', async () => {
    const fillers = Array.from({ length: 8 }, (_, i) => ({
      ...projectFixtures[0],
      id: `filler-${i}`,
      name: `Filler ${i}`,
      activity: activity({ healthScore: 80 - i * 5 }),
    }))
    const needle = {
      ...projectFixtures[0],
      id: 'needle',
      name: 'Needle App',
      activity: activity({ healthScore: 100 }),
    }

    await renderWithProjects([...fillers, needle])

    expect(screen.queryByText('Needle App')).not.toBeInTheDocument()

    const filterInput = screen.getByRole('searchbox', { name: 'Filter projects by name' })
    await act(async () => {
      fireEvent.change(filterInput, { target: { value: 'needle' } })
    })

    expect(screen.getByText('Needle App')).toBeInTheDocument()
  })

  it('gives rows a visible hover tint using the established surface-hover token', async () => {
    await act(async () => {
      renderWithQuery(<ProjectStatusTable />)
    })

    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).toHaveClass('hover:bg-surface-hover/60')
  })

  it('marks the pass-rate and suites columns to collapse in a narrow container, with a name-cell metrics line as the fallback', async () => {
    await renderWithProjects([{ ...projectFixtures[0], activity: activity({ aiPendingCount: 2 }) }])

    const passRateHeader = screen.getByRole('columnheader', { name: 'Pass rate' })
    const suitesHeader = screen.getByRole('columnheader', { name: 'Suites' })
    expect(passRateHeader).toHaveClass('@max-2xl:hidden')
    expect(suitesHeader).toHaveClass('@max-2xl:hidden')

    const [row] = screen.getAllByRole('row').slice(1)
    const metricsLine = within(row).getByTestId('project-row-metrics')
    expect(metricsLine).toHaveClass('@2xl:hidden')
  })
})
