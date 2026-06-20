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
  it('renders project name and description', async () => {
    await act(async () => { render(<ProjectCard project={mockProject} />) })
    expect(screen.getByText('Ecommerce App')).toBeInTheDocument()
    expect(screen.getByText(/Checkout/)).toBeInTheDocument()
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

  it('clamps description at 2 lines', async () => {
    const longDesc = { ...mockProject, description: 'A very long description that should be clamped. '.repeat(10) }
    await act(async () => { render(<ProjectCard project={longDesc} />) })
    const desc = screen.getByText(/A very long/)
    expect(desc.className).toContain('line-clamp-2')
  })
})
