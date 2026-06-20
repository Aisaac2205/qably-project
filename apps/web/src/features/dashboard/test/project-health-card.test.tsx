import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ProjectHealthCard } from '@/features/dashboard/components/project-health-card'
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
  activeRunCount: 0,
  aiPendingCount: 3,
  createdAt: '2026-01-20T00:00:00Z',
}

describe('ProjectHealthCard', () => {
  it('renders project name', async () => {
    await act(async () => {
      render(
        <ProjectHealthCard
          project={mockProject}
          lastRunStatus="pass"
          lastRunAt="2026-06-16T10:00:00Z"
          suiteCount={12}
          aiPendingCount={3}
        />,
      )
    })
    expect(screen.getByText('Ecommerce App')).toBeInTheDocument()
  })

  it('renders status chip', async () => {
    await act(async () => {
      render(
        <ProjectHealthCard
          project={mockProject}
          lastRunStatus="pass"
          lastRunAt="2026-06-16T10:00:00Z"
          suiteCount={12}
          aiPendingCount={3}
        />,
      )
    })
    expect(screen.getByText('Pass')).toBeInTheDocument()
  })

  it('renders health score', async () => {
    await act(async () => {
      render(
        <ProjectHealthCard
          project={mockProject}
          lastRunStatus="pass"
          lastRunAt="2026-06-16T10:00:00Z"
          suiteCount={12}
          aiPendingCount={3}
        />,
      )
    })
    expect(screen.getByText('90%')).toBeInTheDocument()
    expect(screen.getByText('health')).toBeInTheDocument()
  })

  it('renders suite count', async () => {
    await act(async () => {
      render(
        <ProjectHealthCard
          project={mockProject}
          lastRunStatus="pass"
          lastRunAt="2026-06-16T10:00:00Z"
          suiteCount={12}
          aiPendingCount={3}
        />,
      )
    })
    // "12 suites" is split: <span>12</span> suites
    expect(screen.getByText((content, element) => {
      return element?.textContent === '12 suites'
    })).toBeInTheDocument()
  })

  it('renders AI pending count', async () => {
    await act(async () => {
      render(
        <ProjectHealthCard
          project={mockProject}
          lastRunStatus="pass"
          lastRunAt="2026-06-16T10:00:00Z"
          suiteCount={12}
          aiPendingCount={3}
        />,
      )
    })
    // "3 AI pending" is split: <span>3</span> AI pending
    expect(screen.getByText((content, element) => {
      return element?.textContent === '3 AI pending'
    })).toBeInTheDocument()
  })

  it('renders link to project', async () => {
    await act(async () => {
      render(
        <ProjectHealthCard
          project={mockProject}
          lastRunStatus="pass"
          lastRunAt="2026-06-16T10:00:00Z"
          suiteCount={12}
          aiPendingCount={3}
        />,
      )
    })
    const link = screen.getByRole('link', { name: /ecommerce app/i })
    expect(link).toBeInTheDocument()
    expect(link.getAttribute('href')).toBe('/projects/proj-1')
  })

  it('renders fail status correctly', async () => {
    await act(async () => {
      render(
        <ProjectHealthCard
          project={{ ...mockProject, id: 'proj-2', name: 'Mobile App', healthScore: 45 }}
          lastRunStatus="fail"
          lastRunAt="2026-06-16T09:30:00Z"
          suiteCount={8}
          aiPendingCount={0}
        />,
      )
    })
    expect(screen.getByText('Fail')).toBeInTheDocument()
  })
})
