import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ProjectHome } from '@/features/projects/components/project-home'
import { __resetStore } from '@/lib/mock-store'
import type { Project } from '@qably/types'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

const mockProject: Project = {
  id: 'proj-1',
  name: 'Ecommerce App',
  description: 'Checkout, catalog, and user account flows.',
  githubRepo: 'acme/ecommerce',
  organizationId: 'org-1',
  healthScore: 90,
  lastRunStatus: 'pass',
  lastRunAt: '2026-06-16T10:00:00Z',
  suiteCount: 12,
  activeRunCount: 1,
  aiPendingCount: 3,
  createdAt: '2026-01-20T00:00:00Z',
}

describe('ProjectHome (thin shell)', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders the project name as h1', async () => {
    await act(async () => { render(<ProjectHome project={mockProject} />) })
    expect(screen.getByRole('heading', { level: 1, name: 'Ecommerce App' })).toBeInTheDocument()
  })

  it('renders the project description', async () => {
    await act(async () => { render(<ProjectHome project={mockProject} />) })
    expect(screen.getByText(/Checkout, catalog/)).toBeInTheDocument()
  })

  it('omits the description when project has none', async () => {
    const noDesc = { ...mockProject, description: undefined }
    await act(async () => { render(<ProjectHome project={noDesc} />) })
    expect(screen.queryByText(/Checkout, catalog/)).not.toBeInTheDocument()
  })

  it('renders the SuiteList with the seeded suites', async () => {
    await act(async () => { render(<ProjectHome project={mockProject} />) })
    expect(screen.getByText('Authentication')).toBeInTheDocument()
    expect(screen.getByText('Checkout')).toBeInTheDocument()
    expect(screen.getByText('User Account')).toBeInTheDocument()
  })

  it('renders the filter bar from SuiteList', async () => {
    await act(async () => { render(<ProjectHome project={mockProject} />) })
    expect(screen.getByPlaceholderText(/Search by name/i)).toBeInTheDocument()
  })

  it('does NOT render a KPI strip or activity feed (those live in /dashboard, /runs, /ai-review)', async () => {
    await act(async () => { render(<ProjectHome project={mockProject} />) })
    expect(screen.queryByText('Recent runs')).not.toBeInTheDocument()
    expect(screen.queryByText('Recent suites')).not.toBeInTheDocument()
    expect(screen.queryByText('Pending AI cases')).not.toBeInTheDocument()
    // No KPI group either
    expect(screen.queryByRole('group', { name: /Project health/i })).not.toBeInTheDocument()
  })

  it('does NOT render the health dot or last-run chip in the home (moved out of project header)', async () => {
    await act(async () => { render(<ProjectHome project={mockProject} />) })
    expect(screen.queryByText(/Health \d+%/)).not.toBeInTheDocument()
  })
})
