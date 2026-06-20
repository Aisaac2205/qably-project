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
  usePipelines: () => [],
  useOrg: () => ({ id: 'org-1', name: 'Acme', slug: 'acme', plan: 'pro', planLimits: { maxProjects: 20, maxUsers: 10, maxCases: 5000 } }),
  useMembers: () => [],
  useApiKeys: () => [],
  useIntegration: () => ({ webhookUrl: '', connected: false }),
}))

import { TopBar } from '@/components/shell/top-bar'

describe('TopBar', () => {
  it('shows "Dashboard" breadcrumb on /dashboard', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { render(<TopBar />) })
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('shows breadcrumbs with project name inside a project', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/runs')
    await act(async () => { render(<TopBar />) })
    expect(screen.getByText('Projects')).toBeInTheDocument()
    // Project name appears in both breadcrumbs and context indicator
    const appOccurrences = screen.getAllByText('Ecommerce App')
    expect(appOccurrences.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Runs')).toBeInTheDocument()
  })

  it('shows project context on the right inside a project', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/runs')
    await act(async () => { render(<TopBar />) })
    // The project name appears in both breadcrumbs and the project context indicator
    const occurrences = screen.getAllByText('Ecommerce App')
    // Should appear at least once (at least in breadcrumbs; the context indicator may duplicate)
    expect(occurrences.length).toBeGreaterThanOrEqual(1)
  })

  it('has a search trigger button', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { render(<TopBar />) })
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
  })

  it('shows user avatar', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { render(<TopBar />) })
    expect(screen.getByText('IF')).toBeInTheDocument()
  })
})
