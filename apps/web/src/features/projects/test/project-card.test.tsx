import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ProjectCard } from '@/features/projects/components/project-card'
import type { Project } from '@qably/types'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

const mockProject: Project = {
  id: 'proj-1',
  name: 'Ecommerce App',
  description: 'Checkout, catalog, and user account flows.',
  githubRepo: 'acme/ecommerce-app',
  organizationId: 'org-1',
  healthScore: 90,
  lastRunStatus: 'pass',
  lastRunAt: '2026-06-16T10:00:00Z',
  suiteCount: 12,
  activeRunCount: 1,
  aiPendingCount: 3,
  createdAt: '2026-01-20T00:00:00Z',
}

describe('ProjectCard', () => {
  it('renders project name', async () => {
    await act(async () => { render(<ProjectCard project={mockProject} />) })
    expect(screen.getByText('Ecommerce App')).toBeInTheDocument()
  })

  it('shows health score', async () => {
    await act(async () => { render(<ProjectCard project={mockProject} />) })
    expect(screen.getByText('90%')).toBeInTheDocument()
  })

  it('shows suite, active run, and AI pending counts', async () => {
    await act(async () => { render(<ProjectCard project={mockProject} />) })
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText(/suites/)).toBeInTheDocument()
    expect(screen.getByText(/active/)).toBeInTheDocument()
    expect(screen.getByText(/AI pending/)).toBeInTheDocument()
  })

  it('shows last run status chip with icon and label', async () => {
    await act(async () => { render(<ProjectCard project={mockProject} />) })
    expect(screen.getByText('Pass')).toBeInTheDocument()
  })

  it('links to project detail page', async () => {
    await act(async () => { render(<ProjectCard project={mockProject} />) })
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/projects/proj-1')
  })

  it('shows tech icons for provided technologies', async () => {
    const withTech = { ...mockProject, technologies: ['react', 'typescript'] }
    await act(async () => { render(<ProjectCard project={withTech} />) })
    expect(screen.getByAltText('React')).toBeInTheDocument()
    expect(screen.getByAltText('TypeScript')).toBeInTheDocument()
  })

  it('shows empty stack placeholder when no technologies set', async () => {
    const noTech = { ...mockProject, technologies: [] }
    await act(async () => { render(<ProjectCard project={noTech} />) })
    expect(screen.getByText('No stack selected')).toBeInTheDocument()
  })
})
