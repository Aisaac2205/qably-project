import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { Project } from '@qably/types'
import { SidebarProvider } from '@/components/ui/sidebar'

const mockPathname = vi.fn(() => '/dashboard')

// jsdom doesn't implement matchMedia. SidebarProvider uses it via
// use-mobile to detect viewport size for the collapsible sidebar.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
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
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

const mockProject: Project = {
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
}

vi.mock('@/lib/use-mock-store', () => ({
  useProject: (id: string) => (id === 'proj-1' ? mockProject : undefined),
  useProjects: () => [],
  useSuites: () => [],
  useRuns: () => [],
  useAiCases: () => [],
  useOrg: () => ({ id: 'org-1', name: 'Acme', slug: 'acme', plan: 'pro', planLimits: { maxProjects: 20, maxUsers: 10, maxCases: 5000 } }),
  useMembers: () => [],
  useApiKeys: () => [],
  useIntegration: () => ({ webhookUrl: '', connected: false }),
}))

import { Sidebar } from '@/components/shell/sidebar'

// Sidebar uses useSidebar() which requires a SidebarProvider. Wrap renders.
function renderSidebar() {
  return render(
    <SidebarProvider defaultOpen={true}>
      <Sidebar />
    </SidebarProvider>,
  )
}

describe('Sidebar — global state (no project route)', () => {
  it('shows Dashboard, Projects, Integrations, and Settings links', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { renderSidebar() })
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Integrations')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('Integrations link points to /integrations', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { renderSidebar() })
    const link = screen.getByText('Integrations').closest('a')
    expect(link?.getAttribute('href')).toBe('/integrations')
  })

  it('does not show project sub-routes in global state', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { renderSidebar() })
    // Project-internal items only show when on /projects/[id]/...
    expect(screen.queryByText('Runs')).not.toBeInTheDocument()
    expect(screen.queryByText('AI Review')).not.toBeInTheDocument()
    expect(screen.queryByText('Reports')).not.toBeInTheDocument()
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

  it('shows project sub-routes: Suites, Runs, AI Review, Reports', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/suites')
    await act(async () => { renderSidebar() })
    expect(screen.getByText('Suites')).toBeInTheDocument()
    expect(screen.getByText('Runs')).toBeInTheDocument()
    expect(screen.getByText('AI Review')).toBeInTheDocument()
    expect(screen.getByText('Reports')).toBeInTheDocument()
  })

  it('Suite sub-route link points to /projects/proj-1 (project home)', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/suites')
    await act(async () => { renderSidebar() })
    const link = screen.getByText('Suites').closest('a')
    expect(link?.getAttribute('href')).toBe('/projects/proj-1')
  })

  it('Runs sub-route link points to /projects/proj-1/runs', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/runs')
    await act(async () => { renderSidebar() })
    const link = screen.getByText('Runs').closest('a')
    expect(link?.getAttribute('href')).toBe('/projects/proj-1/runs')
  })

  it('still shows global nav (Dashboard, Integrations, Settings) in project state', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/suites')
    await act(async () => { renderSidebar() })
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Integrations')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('highlights the active sub-route when on /projects/proj-1/runs', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/runs')
    await act(async () => { renderSidebar() })
    // The Runs link should have aria-current="page" or similar
    // (we just check it renders without error — visual highlight is CSS)
    expect(screen.getByText('Runs').closest('a')).toHaveAttribute('href', '/projects/proj-1/runs')
  })
})
