import { render as rtlRender, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { ProjectSummary } from '@qably/types'
import { QueryProvider } from '@/providers/query-provider'

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: QueryProvider })
}

const mockPathname = vi.fn(() => '/dashboard')

const { useProjectSpy } = vi.hoisted(() => ({ useProjectSpy: vi.fn<(id: string) => void>() }))

const STATIC_PROJECT_SEGMENTS = new Set(['new'])

function routeParamsFor(pathname: string): Record<string, string> {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'projects') return {}
  const candidate = parts[1]
  if (!candidate || STATIC_PROJECT_SEGMENTS.has(candidate)) return {}
  return { id: candidate }
}

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useParams: () => routeParamsFor(mockPathname()),
}))

vi.mock('@/lib/auth-client', () => ({
  useSession: () => ({
    data: { user: { name: 'Ana Ruiz', image: null } },
    isPending: false,
  }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

const mockProject: ProjectSummary = {
  id: 'proj-1',
  name: 'Ecommerce App',
  description: '',
  organizationId: 'org-1',
  healthScore: 90,
  lastRunStatus: 'pass',
  lastRunAt: '2026-06-16T10:00:00Z',
  suiteCount: 12,
  activeRunCount: 0,
  aiPendingCount: 3,
  createdAt: '2026-01-20T00:00:00Z',
  updatedAt: '2026-01-20T00:00:00Z',
  technologies: [],
}

vi.mock('@/lib/use-mock-store', () => ({
  useProject: (id: string) => (id === 'proj-1' ? mockProject : undefined),
  useSuites: () => [],
  useRuns: () => [],
  useAiCases: () => [],
  useProposals: () => [],
  useMembers: () => [],
  useIntegration: () => ({ webhookUrl: '', connected: false }),
}))

vi.mock('@/components/ui/sidebar', () => ({
  SidebarTrigger: () => <button type="button" aria-label="Toggle sidebar" />,
}))

import { TopBar } from '@/components/shell/top-bar'

vi.mock('@/features/projects/hooks/use-project', async () => {
  const { getProject } = await import('@/lib/mock-store')
  return {
    useProject: (id: string) => {
      useProjectSpy(id)
      return { project: getProject(id), isLoading: false, isError: false }
    },
  }
})


describe('TopBar', () => {
  it('shows Dashboard as breadcrumb context on /dashboard, never as a page heading', async () => {
    mockPathname.mockReturnValue('/dashboard')
    const { container } = render(<TopBar />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    // Unimplemented controls stay out of the keyboard order.
    expect(screen.queryByRole('button', { name: /search/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /user menu/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument()
    expect(screen.getByText('AR')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass('bg-surface', 'border-b', 'border-border')
  })

  it('shows the sub-route title on project routes, not as a page heading', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/runs')
    await act(async () => { render(<TopBar />) })
    expect(screen.getByText('Runs')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('does not expose the deferred search command as a dead control', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { render(<TopBar />) })
    expect(screen.queryByRole('button', { name: /search/i })).not.toBeInTheDocument()
  })

  it('shows Review Inbox as breadcrumb context on /review-inbox, not as a page heading', async () => {
    mockPathname.mockReturnValue('/review-inbox')
    render(<TopBar />)
    expect(screen.getByText('Review Inbox')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('shows Project Chat as breadcrumb context on the aeris sub-route, not as a page heading', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/aeris')
    await act(async () => { render(<TopBar />) })
    expect(screen.getByText('Project Chat')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('shows Projects as breadcrumb context on /projects, not as a page heading', async () => {
    mockPathname.mockReturnValue('/projects')
    render(<TopBar />)
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('shows Notifications as breadcrumb context on /notifications, not as a page heading', async () => {
    mockPathname.mockReturnValue('/notifications')
    render(<TopBar />)
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('shows Settings as breadcrumb context on /settings, not as a page heading', async () => {
    mockPathname.mockReturnValue('/settings')
    render(<TopBar />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('shows the signed-in user, not a hardcoded name', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { render(<TopBar />) })
    expect(screen.getByLabelText('Ana Ruiz')).toBeInTheDocument()
    expect(screen.getByText('AR')).toBeInTheDocument()
  })
})

describe('TopBar — static sibling routes under /projects', () => {
  it('never requests a project for /projects/new', async () => {
    useProjectSpy.mockClear()
    mockPathname.mockReturnValue('/projects/new')

    await act(async () => { render(<TopBar />) })

    expect(useProjectSpy).toHaveBeenCalled()
    expect(useProjectSpy).not.toHaveBeenCalledWith('new')
    expect(useProjectSpy.mock.calls.every(([id]) => id === '')).toBe(true)
  })

  it('still requests the project on a dynamic project route', async () => {
    useProjectSpy.mockClear()
    mockPathname.mockReturnValue('/projects/proj-1/runs')

    await act(async () => { render(<TopBar />) })

    expect(useProjectSpy).toHaveBeenCalledWith('proj-1')
  })
})
