import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
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
  description: 'Checkout flows',
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

describe('ProjectHome', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders project header', async () => {
    await act(async () => { render(<ProjectHome project={mockProject} />) })
    expect(screen.getByText('Ecommerce App')).toBeInTheDocument()
  })

  it('shows recent runs section', async () => {
    await act(async () => { render(<ProjectHome project={mockProject} />) })
    expect(screen.getByText('Recent runs')).toBeInTheDocument()
    // Should show at least one run name
    const runNames = screen.getAllByText(/Run #/)
    expect(runNames.length).toBeGreaterThan(0)
  })

  it('shows pending AI cases section', async () => {
    await act(async () => { render(<ProjectHome project={mockProject} />) })
    expect(screen.getByText('Pending AI cases')).toBeInTheDocument()
  })

  it('shows recent pipelines section', async () => {
    await act(async () => { render(<ProjectHome project={mockProject} />) })
    expect(screen.getByText('Recent pipelines')).toBeInTheDocument()
  })
})
