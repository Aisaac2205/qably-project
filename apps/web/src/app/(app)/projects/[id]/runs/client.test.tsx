import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RunListPageClient } from './client'
import { renderWithQuery } from '@/lib/query-test-utils'
import * as useProjectModule from '@/features/projects/hooks/use-project'

function stubProject(overrides: Partial<ReturnType<typeof useProjectModule.useProject>> = {}) {
  vi.spyOn(useProjectModule, 'useProject').mockReturnValue({
    project: {
      id: 'proj-1',
      name: 'Ecommerce App',
      organizationId: 'org-1',
      technologies: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      hasManualCases: true,
    },
    isLoading: false,
    isError: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useProjectModule.useProject>)
}

describe('RunListPageClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows an enabled New run link when the project has manual cases', () => {
    stubProject({ project: { id: 'proj-1', name: 'Ecommerce App', organizationId: 'org-1', technologies: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', hasManualCases: true } })

    renderWithQuery(<RunListPageClient projectId="proj-1" />)

    const link = screen.getByRole('link', { name: /new run/i })
    expect(link).toHaveAttribute('href', '/projects/proj-1/runs/new')
  })

  it('disables New run and shows a hint when the project has no manual cases', () => {
    stubProject({ project: { id: 'proj-1', name: 'Ecommerce App', organizationId: 'org-1', technologies: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', hasManualCases: false } })

    renderWithQuery(<RunListPageClient projectId="proj-1" />)

    const button = screen.getByRole('button', { name: /new run/i })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('link', { name: /new run/i })).not.toBeInTheDocument()
    expect(screen.getByText(/automated cases are fed by ci/i)).toBeInTheDocument()
  })
})
