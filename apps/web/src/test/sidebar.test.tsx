import { render, screen, act, within } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import type { ProjectSummary } from '@qably/types'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

const mockPathname = vi.fn(() => '/dashboard')
let isMobileViewport = false

// jsdom doesn't implement matchMedia. SidebarProvider uses it via
// use-mobile to detect viewport size for the collapsible sidebar.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      get matches() { return isMobileViewport },
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useParams: () => ({}),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: { email: vi.fn(), social: vi.fn() },
    signUp: { email: vi.fn() },
    signOut: vi.fn().mockResolvedValue({ data: {}, error: null }),
  },
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

const mockProject: ProjectSummary = {
  id: 'proj-1',
  name: 'Ecommerce App',
  description: 'Test project',
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
  useProjects: () => [],
  useSuites: () => [],
  useRuns: () => [],
  useAiCases: () => [],
  useProposals: () => [],
  useOrg: () => ({ id: 'org-1', name: 'Acme', slug: 'acme', plan: 'equipo', planLimits: { maxProjects: 20, maxUsers: 10, maxCases: 5000 } }),
  useMembers: () => [],
  useApiKeys: () => [],
  useIntegration: () => ({ webhookUrl: '', connected: false }),
}))

import { Sidebar } from '@/components/shell/sidebar'

// Sidebar uses useSidebar() which requires a SidebarProvider. Wrap renders.
function renderSidebar({ defaultOpen = true, includeTrigger = false } = {}) {
  return render(
    <SidebarProvider defaultOpen={defaultOpen}>
      {includeTrigger ? <SidebarTrigger /> : null}
      <Sidebar />
    </SidebarProvider>,
  )
}

afterEach(() => {
  isMobileViewport = false
})

describe('Sidebar — global state (no project route)', () => {
  it('anchors navigation with the Qably product identity instead of workspace data', async () => {
    mockPathname.mockReturnValue('/dashboard')
    const { container } = await act(async () => renderSidebar())

    expect(screen.getByRole('link', { name: 'Qably' })).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByText('Acme')).not.toBeInTheDocument()
    expect(container.querySelector('[data-slot="sidebar-container"]')).toHaveClass('border-r-0!')
  })

  it('presents the current user as a compact bordered account card without a divider', async () => {
    mockPathname.mockReturnValue('/dashboard')
    const { container } = await act(async () => renderSidebar())

    const footer = container.querySelector('[data-slot="sidebar-footer"]')
    const account = container.querySelector('[data-slot="sidebar-account"]')
    expect(footer).not.toHaveClass('border-t')
    expect(account).toHaveClass('h-12', 'rounded-xl', 'border', 'border-border-sidebar')
    expect(account).toHaveTextContent('Isaac F.')
    expect(account).toHaveTextContent('Admin')
  })

  it('shows the aligned global destinations', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { renderSidebar() })
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Review Inbox')).toBeInTheDocument()
    expect(screen.getByText('Notifications')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('maps every global destination to a safe route', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { renderSidebar() })
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByText('Projects').closest('a')).toHaveAttribute('href', '/projects')
    expect(screen.getByText('Review Inbox').closest('a')).toHaveAttribute('href', '/review-inbox')
    expect(screen.getByText('Notifications').closest('a')).toHaveAttribute('href', '/notifications')
    expect(screen.getByText('Settings').closest('a')).toHaveAttribute('href', '/settings')
  })

  it('does not show project sub-routes in global state', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { renderSidebar() })
    // Project-internal items only show when on /projects/[id]/...
    expect(screen.queryByText('Runs')).not.toBeInTheDocument()
    expect(screen.queryByText('Review')).not.toBeInTheDocument()
    expect(screen.queryByText('Quality')).not.toBeInTheDocument()
  })
})

describe('Sidebar — project state (inside /projects/proj-1/...)', () => {
  it('shows the project name inside the back link (Linear-style)', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/suites')
    await act(async () => { renderSidebar() })
    // Project name is rendered as the back link — a single subtle row.
    expect(screen.getByText('Ecommerce App')).toBeInTheDocument()
  })

  it('project name is a link to /projects', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/suites')
    await act(async () => { renderSidebar() })
    const link = screen.getByText('Ecommerce App').closest('a')
    expect(link?.getAttribute('href')).toBe('/projects')
  })

  it('shows the aligned project destinations', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/suites')
    await act(async () => { renderSidebar() })
    expect(screen.getByText('Repository')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
    expect(screen.getByText('Test Library')).toBeInTheDocument()
    expect(screen.getByText('Runs')).toBeInTheDocument()
    expect(screen.getByText('Quality')).toBeInTheDocument()
  })

  it('maps every project destination to an existing route', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/suites')
    await act(async () => { renderSidebar() })
    expect(screen.getByText('Repository').closest('a')).toHaveAttribute('href', '/projects/proj-1/repository')
    expect(screen.getByText('Review').closest('a')).toHaveAttribute('href', '/projects/proj-1/ai-review')
    expect(screen.getByText('Test Library').closest('a')).toHaveAttribute('href', '/projects/proj-1/suites')
    expect(screen.getByText('Runs').closest('a')).toHaveAttribute('href', '/projects/proj-1/runs')
    expect(screen.getByText('Quality').closest('a')).toHaveAttribute('href', '/projects/proj-1/reports')
  })

  it('Runs sub-route link points to /projects/proj-1/runs', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/runs')
    await act(async () => { renderSidebar() })
    const link = screen.getByText('Runs').closest('a')
    expect(link?.getAttribute('href')).toBe('/projects/proj-1/runs')
  })

  it('replaces global navigation with the project hierarchy', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/suites')
    await act(async () => { renderSidebar() })
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument()
    expect(screen.queryByText('Review Inbox')).not.toBeInTheDocument()
    expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
    expect(screen.queryByText('Settings')).not.toBeInTheDocument()
  })
})

describe('Sidebar — current destinations', () => {
  type RenderOptions = { defaultOpen?: boolean; mobile?: boolean }

  const cases: ReadonlyArray<readonly [string, string, string, string, RenderOptions]> = [
    ['global expanded', '/notifications', 'Notifications', '/notifications', {}],
    ['global collapsed', '/projects/new', 'Projects', '/projects', { defaultOpen: false }],
    ['global mobile', '/review-inbox', 'Review Inbox', '/review-inbox', { mobile: true }],
    ['project root aliases to Test Library', '/projects/proj-1', 'Test Library', '/projects/proj-1/suites', {}],
    ['project Review nested destination', '/projects/proj-1/ai-review/case-1', 'Review', '/projects/proj-1/ai-review', {}],
    ['project Quality nested destination', '/projects/proj-1/reports/run-1', 'Quality', '/projects/proj-1/reports', {}],
    ['project collapsed', '/projects/proj-1/runs', 'Runs', '/projects/proj-1/runs', { defaultOpen: false }],
    ['project mobile', '/projects/proj-1/repository', 'Repository', '/projects/proj-1/repository', { mobile: true }],
  ]

  it.each(cases)('%s exposes exactly one correct current link', async (_mode, pathname, name, href, options) => {
    isMobileViewport = options.mobile ?? false
    mockPathname.mockReturnValue(pathname)
    await act(async () => { renderSidebar({ defaultOpen: options.defaultOpen, includeTrigger: options.mobile }) })

    if (options.mobile) {
      await act(async () => { screen.getByRole('button', { name: 'Toggle Sidebar' }).click() })
    }
    const links = options.mobile ? within(screen.getByRole('dialog', { name: 'Sidebar' })) : screen

    expect(links.getAllByRole('link', { current: 'page' })).toHaveLength(1)
    expect(links.getByRole('link', { name, current: 'page' })).toHaveAttribute('href', href)
  })
})
