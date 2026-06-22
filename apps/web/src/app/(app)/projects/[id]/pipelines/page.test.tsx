import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectProvider } from '@/features/projects/context/project-context'
import { __resetStore } from '@/lib/mock-store'
import type { Project } from '@qably/types'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
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

import PipelinesPage from './page'

describe('PipelinesPage (CI runs wrapper)', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders the Pipelines heading', async () => {
    await act(async () => {
      render(
        <ProjectProvider projectId="proj-1" project={mockProject}>
          <PipelinesPage />
        </ProjectProvider>
      )
    })
    expect(screen.getByRole('heading', { name: 'Pipelines' })).toBeInTheDocument()
  })

  it('renders only CI runs (source=github_actions)', async () => {
    await act(async () => {
      render(
        <ProjectProvider projectId="proj-1" project={mockProject}>
          <PipelinesPage />
        </ProjectProvider>
      )
    })
    // run-10 is the only CI run for proj-1
    expect(screen.getByText('Run #10')).toBeInTheDocument()
    // manual and api runs must NOT appear
    expect(screen.queryByText('Run #12')).not.toBeInTheDocument()
    expect(screen.queryByText('Run #11')).not.toBeInTheDocument()
    expect(screen.queryByText('Run #9')).not.toBeInTheDocument()
  })

  it('shows subtitle clarifying CI source', async () => {
    await act(async () => {
      render(
        <ProjectProvider projectId="proj-1" project={mockProject}>
          <PipelinesPage />
        </ProjectProvider>
      )
    })
    expect(screen.getByText(/Runs from CI/)).toBeInTheDocument()
  })
})
