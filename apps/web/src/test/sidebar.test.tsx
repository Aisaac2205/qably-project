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

describe('Sidebar — global state (Commit 2 nav: 4 items)', () => {
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

  it('does not show project-internal items in global state', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { renderSidebar() })
    expect(screen.queryByText('Suites')).not.toBeInTheDocument()
    expect(screen.queryByText('Runs')).not.toBeInTheDocument()
    expect(screen.queryByText('Reports')).not.toBeInTheDocument()
    expect(screen.queryByText('AI Review')).not.toBeInTheDocument()
    expect(screen.queryByText('AI Cases')).not.toBeInTheDocument()
  })
})
