import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ProjectHeader } from '@/features/projects/components/project-header'
import type { Project } from '@qably/types'

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

describe('ProjectHeader', () => {
  it('renders project name as h1', async () => {
    await act(async () => { render(<ProjectHeader project={mockProject} />) })
    expect(screen.getByRole('heading', { level: 1, name: 'Ecommerce App' })).toBeInTheDocument()
  })

  it('renders project description when present', async () => {
    await act(async () => { render(<ProjectHeader project={mockProject} />) })
    expect(screen.getByText('Checkout flows')).toBeInTheDocument()
  })

  it('shows health score with label', async () => {
    await act(async () => { render(<ProjectHeader project={mockProject} />) })
    expect(screen.getByText(/Health 90%/)).toBeInTheDocument()
  })

  it('shows last run status chip', async () => {
    await act(async () => { render(<ProjectHeader project={mockProject} />) })
    expect(screen.getByText('Pass')).toBeInTheDocument()
  })

  it('shows red dot for health score < 50', async () => {
    const failing = { ...mockProject, healthScore: 30 }
    await act(async () => { render(<ProjectHeader project={failing} />) })
    const dot = document.querySelector('.bg-fail')
    expect(dot).toBeTruthy()
  })

  it('shows warning dot for health score 50-79', async () => {
    const warn = { ...mockProject, healthScore: 60 }
    await act(async () => { render(<ProjectHeader project={warn} />) })
    const dot = document.querySelector('.bg-warn')
    expect(dot).toBeTruthy()
  })

  it('does NOT render the suite/active-run/AI-pending counts (moved to KPI)', async () => {
    await act(async () => { render(<ProjectHeader project={mockProject} />) })
    // Counts live in ProjectKpiRow, not here
    expect(screen.queryByText(/active runs/)).not.toBeInTheDocument()
    expect(screen.queryByText(/AI pending/)).not.toBeInTheDocument()
  })
})
