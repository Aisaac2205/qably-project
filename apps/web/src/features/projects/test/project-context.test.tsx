import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  ProjectProvider,
  useProjectContext,
} from '@/features/projects/context/project-context'

function ReadContext() {
  const { projectId } = useProjectContext()
  return <span data-testid="ctx-id">{projectId}</span>
}

function CaptureContext({ sink }: { sink: string[] }) {
  const context = useProjectContext()
  sink.push(...Object.keys(context))
  return null
}

describe('ProjectContext', () => {
  it('provides the project id to children', async () => {
    await act(async () => {
      render(
        <ProjectProvider projectId="proj-1">
          <ReadContext />
        </ProjectProvider>,
      )
    })

    expect(screen.getByTestId('ctx-id')).toHaveTextContent('proj-1')
  })

  it('carries no project copy, so pages read it from the api instead', async () => {
    const keys: string[] = []

    await act(async () => {
      render(
        <ProjectProvider projectId="proj-1">
          <CaptureContext sink={keys} />
        </ProjectProvider>,
      )
    })

    expect([...new Set(keys)]).toEqual(['projectId'])
  })

  it('throws when useProjectContext is used outside provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<ReadContext />)).toThrow(
      'useProjectContext must be used within a ProjectProvider',
    )

    consoleError.mockRestore()
  })
})
