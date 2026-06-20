import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  ProjectProvider,
  useProjectContext,
} from '@/features/projects/context/project-context'
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

function ReadContext({ testId }: { testId: string }) {
  const { projectId, project } = useProjectContext()
  return (
    <div data-testid={testId}>
      <span data-testid="ctx-id">{projectId}</span>
      <span data-testid="ctx-name">{project?.name}</span>
    </div>
  )
}

describe('ProjectContext', () => {
  it('provides projectId and project to children', async () => {
    await act(async () => {
      render(
        <ProjectProvider projectId="proj-1" project={mockProject}>
          <ReadContext testId="child" />
        </ProjectProvider>,
      )
    })
    expect(screen.getByTestId('ctx-id')).toHaveTextContent('proj-1')
    expect(screen.getByTestId('ctx-name')).toHaveTextContent('Ecommerce App')
  })

  it('throws when useProjectContext is used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<ReadContext testId="child" />)).toThrow(
      'useProjectContext must be used within a ProjectProvider',
    )
    consoleError.mockRestore()
  })

  it('handles undefined project gracefully', async () => {
    await act(async () => {
      render(
        <ProjectProvider projectId="proj-1" project={undefined}>
          <ReadContext testId="child" />
        </ProjectProvider>,
      )
    })
    expect(screen.getByTestId('ctx-id')).toHaveTextContent('proj-1')
    expect(screen.getByTestId('ctx-name')).toBeEmptyDOMElement()
  })
})
