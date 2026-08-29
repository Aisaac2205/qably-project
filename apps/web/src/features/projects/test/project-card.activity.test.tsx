import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectListItem } from '@qably/types'
import { ProjectCard } from '@/features/projects/components/project-card'

vi.mock('@/features/projects/lib/aggregate', () => ({
  useProjectAggregate: () => ({ delete: vi.fn() }),
}))

const base: ProjectListItem = {
  id: 'p1',
  name: 'Checkout',
  organizationId: 'org-1',
  technologies: ['react'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  suiteCount: 3,
  activity: null,
}

describe('ProjectCard without run activity', () => {
  it('shows the real suite count served by the api', () => {
    render(<ProjectCard project={base} />)

    expect(screen.getByText(/3 suites/)).toBeInTheDocument()
  })

  it('does not render a health score it cannot compute', () => {
    render(<ProjectCard project={base} />)

    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('says runs are not measured yet instead of showing a passing state', () => {
    render(<ProjectCard project={base} />)

    expect(screen.getByText(/No runs yet/i)).toBeInTheDocument()
  })
})

describe('ProjectCard with run activity', () => {
  const withActivity: ProjectListItem = {
    ...base,
    activity: {
      healthScore: 87,
      lastRunStatus: 'pass',
      lastRunAt: '2026-02-01T00:00:00.000Z',
      activeRunCount: 1,
      aiPendingCount: 2,
    },
  }

  it('renders the health score once the api reports one', () => {
    render(<ProjectCard project={withActivity} />)

    expect(screen.getByText('87%')).toBeInTheDocument()
  })

  it('drops the empty state once activity exists', () => {
    render(<ProjectCard project={withActivity} />)

    expect(screen.queryByText(/No runs yet/i)).not.toBeInTheDocument()
  })
})
