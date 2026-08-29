import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ProjectListItem } from '@qably/types'
import { ProjectGrid } from '@/features/projects/components/project-grid'
import { listProjects } from '@/features/projects/api/projects.api'

vi.mock('@/features/projects/api/projects.api', () => ({ listProjects: vi.fn() }))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

vi.mock('@/features/projects/lib/aggregate', () => ({
  useProjectAggregate: () => ({ delete: vi.fn() }),
}))

const list = vi.mocked(listProjects)

function project(overrides: Partial<ProjectListItem> & { id: string; name: string }): ProjectListItem {
  return {
    organizationId: 'org-1',
    technologies: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    suiteCount: 0,
    activity: null,
    ...overrides,
  }
}

function renderGrid() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ProjectGrid />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ProjectGrid', () => {
  it('renders a card for every project the api served', async () => {
    list.mockResolvedValue([
      project({ id: 'proj-1', name: 'Ecommerce App' }),
      project({ id: 'proj-2', name: 'Mobile App' }),
    ])

    renderGrid()

    expect(await screen.findByText('Ecommerce App')).toBeInTheDocument()
    expect(screen.getByText('Mobile App')).toBeInTheDocument()
  })

  it('puts the most recently active project first', async () => {
    list.mockResolvedValue([
      project({
        id: 'proj-1',
        name: 'Older',
        activity: {
          healthScore: 80, lastRunStatus: 'pass',
          lastRunAt: '2026-06-15T10:00:00Z', activeRunCount: 0, aiPendingCount: 0,
        },
      }),
      project({
        id: 'proj-3',
        name: 'Newer',
        activity: {
          healthScore: 90, lastRunStatus: 'pass',
          lastRunAt: '2026-06-16T10:15:00Z', activeRunCount: 0, aiPendingCount: 0,
        },
      }),
    ])

    renderGrid()

    await screen.findByText('Newer')
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/projects/proj-3')
  })

  it('falls back to updatedAt to order projects that never ran', async () => {
    list.mockResolvedValue([
      project({ id: 'proj-1', name: 'Stale', updatedAt: '2026-01-01T00:00:00.000Z' }),
      project({ id: 'proj-2', name: 'Fresh', updatedAt: '2026-05-01T00:00:00.000Z' }),
    ])

    renderGrid()

    await screen.findByText('Fresh')
    expect(screen.getAllByRole('link')[0]).toHaveAttribute('href', '/projects/proj-2')
  })

  it('shows a busy placeholder while the request is in flight', () => {
    list.mockImplementation(() => new Promise(() => {}))

    const { container } = renderGrid()

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
  })

  it('reports a failure instead of showing an empty project list', async () => {
    list.mockRejectedValue(new Error('network down'))

    renderGrid()

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.queryByText(/No projects/i)).not.toBeInTheDocument()
  })

  it('invites the user to create the first project when the api returns none', async () => {
    list.mockResolvedValue([])

    renderGrid()

    expect(await screen.findByRole('link', { name: /Create/i })).toBeInTheDocument()
  })
})
