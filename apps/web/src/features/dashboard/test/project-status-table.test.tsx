import { render, screen, act, within } from '@testing-library/react'
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

    expect(screen.getByText('90%')).toBeInTheDocument()
  })

  it('says the pass rate is not measured instead of showing 0% for an empty window', async () => {
    await renderWithProjects([
      { ...projectFixtures[0], activity: activity({ healthScore: null }) },
    ])

    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
    expect(screen.getByText('Not measured yet')).toBeInTheDocument()
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
})
