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
  it('renders project name', async () => {
    await act(async () => { render(<ProjectHeader project={mockProject} />) })
    expect(screen.getByText('Ecommerce App')).toBeInTheDocument()
  })

  it('shows health score with dot indicator', async () => {
    await act(async () => { render(<ProjectHeader project={mockProject} />) })
    expect(screen.getByText('90%')).toBeInTheDocument()
  })

  it('shows last run status chip', async () => {
    await act(async () => { render(<ProjectHeader project={mockProject} />) })
    expect(screen.getByText('Pass')).toBeInTheDocument()
  })

  it('shows counts with correct text', async () => {
    await act(async () => { render(<ProjectHeader project={mockProject} />) })
    expect(screen.getByText(/12/)).toBeInTheDocument()
    expect(screen.getByText(/suites/)).toBeInTheDocument()
    expect(screen.getByText(/active runs/)).toBeInTheDocument()
    expect(screen.getByText(/AI pending/)).toBeInTheDocument()
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
})
