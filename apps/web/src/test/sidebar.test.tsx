import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { Project } from '@qably/types'

const mockPathname = vi.fn(() => '/dashboard')

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useParams: () => ({}),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

// Mock useProject to return a project when needed
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

describe('Sidebar — global state', () => {
  it('shows Dashboard, Projects, and Settings links', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { render(<Sidebar />) })
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('does not show project-internal items in global state', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { render(<Sidebar />) })
    // Project-internal routes belong only in ProjectSidebar
    expect(screen.queryByText('Suites')).not.toBeInTheDocument()
    expect(screen.queryByText('Test Suites')).not.toBeInTheDocument()
    expect(screen.queryByText('Runs')).not.toBeInTheDocument()
    expect(screen.queryByText('Pipelines')).not.toBeInTheDocument()
    expect(screen.queryByText('Reports')).not.toBeInTheDocument()
    expect(screen.queryByText('AI Review')).not.toBeInTheDocument()
    expect(screen.queryByText('AI Cases')).not.toBeInTheDocument()
  })

  it('does not show ← Projects in global state', async () => {
    mockPathname.mockReturnValue('/dashboard')
    await act(async () => { render(<Sidebar />) })
    expect(screen.queryByText(/← Projects/)).not.toBeInTheDocument()
  })
})

describe('Sidebar — project state', () => {
  it('shows ← Projects back link when inside a project', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/runs')
    await act(async () => { render(<Sidebar />) })
    expect(screen.getByText(/← Projects/)).toBeInTheDocument()
  })

  it('shows project nav items when inside a project', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/runs')
    await act(async () => { render(<Sidebar />) })
    expect(screen.getByText('Suites')).toBeInTheDocument()
    expect(screen.getByText('Runs')).toBeInTheDocument()
    expect(screen.getByText('AI Review')).toBeInTheDocument()
  })

  it('shows real project name (not raw projectId)', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/runs')
    await act(async () => { render(<Sidebar />) })
    expect(screen.getByText('Ecommerce App')).toBeInTheDocument()
  })

  it('does not show global nav items when inside a project', async () => {
    mockPathname.mockReturnValue('/projects/proj-1/runs')
    await act(async () => { render(<Sidebar />) })
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
  })
})
