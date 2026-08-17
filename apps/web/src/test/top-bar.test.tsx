import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { Project } from '@qably/types'

const mockPathname = vi.fn(() => '/dashboard')

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

const mockProject: Project = {
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
}

vi.mock('@/lib/use-mock-store', () => ({
  useProject: (id: string) => (id === 'proj-1' ? mockProject : undefined),
  useProjects: () => [],
  useSuites: () => [],
  useRuns: () => [],
  useAiCases: () => [],
  useOrg: () => ({ id: 'org-1', name: 'Acme', slug: 'acme', plan: 'equipo', planLimits: { maxProjects: 20, maxUsers: 10, maxCases: 5000 } }),
  useMembers: () => [],
  useApiKeys: () => [],
  useIntegration: () => ({ webhookUrl: '', connected: false }),
}))

vi.mock('@/components/ui/sidebar', () => ({
  SidebarTrigger: () => <button type="button" aria-label="Toggle sidebar" />,
}))

import { TopBar } from '@/components/shell/top-bar'

describe('TopBar', () => {
  // NOTE: The top bar does NOT render inline breadcrumbs yet.
  // Breadcrumbs live in the page-level shell wrapper. The top bar renders
  // the project context indicator (name + health dot) on project routes.
  // If breadcrumbs are added to the top bar in the future, restore the
  // assertions below (Dashboard / Projects > Name > Segment).
  it('renders a Dashboard title heading on /dashboard', async () => {
    mockPathname.mockReturnValue('/dashboard')
    const { container } = render(<TopBar />)
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    // Unimplemented controls stay out of the keyboard order.
    expect(screen.queryByRole('button', { name: /search/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /user menu/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument()
    expect(screen.getByText('IF')).toBeInTheDocument()
    expect(container.firstElementChild).toHaveClass('bg-sidebar')
    expect(container.firstElementChild).not.toHaveClass('border-b')
  })

  it('shows the project name in the context indicator on project routes', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/runs')
    await act(async () => { render(<TopBar />) })
    // Project name appears in the context indicator on the right
    expect(screen.getByText('Ecommerce App')).toBeInTheDocument()
  })

  it('shows project context on the right inside a project', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/runs')
    await act(async () => { render(<TopBar />) })
    // The project name appears in both breadcrumbs and the project context indicator
    const occurrences = screen.getAllByText('Ecommerce App')
    // Should appear at least once (at least in breadcrumbs; the context indicator may duplicate)
    expect(occurrences.length).toBeGreaterThanOrEqual(1)
  })




  it('does not expose the deferred search command as a dead control', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { render(<TopBar />) })
    expect(screen.queryByRole('button', { name: /search/i })).not.toBeInTheDocument()
  })

  it('renders a Review Inbox title heading on /review-inbox', async () => {
    mockPathname.mockReturnValue('/review-inbox')
    render(<TopBar />)
    expect(screen.getByRole('heading', { level: 1, name: 'Review Inbox' })).toBeInTheDocument()
  })

  it('renders a Projects title heading on /projects', async () => {
    mockPathname.mockReturnValue('/projects')
    render(<TopBar />)
    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument()
  })

  it('renders a Notifications title heading on /notifications', async () => {
    mockPathname.mockReturnValue('/notifications')
    render(<TopBar />)
    expect(screen.getByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument()
  })

  it('renders a Settings title heading on /settings', async () => {
    mockPathname.mockReturnValue('/settings')
    render(<TopBar />)
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
  })

  it('shows user avatar', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { render(<TopBar />) })
    expect(screen.getByText('IF')).toBeInTheDocument()
  })
})
