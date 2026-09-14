import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import AerisRoute from '@/app/(app)/projects/[id]/aeris/page'

vi.mock('@/features/ai-review/components/project-chat-panel', () => ({
  ProjectChatPanel: ({ projectId }: { projectId: string }) => (
    <div data-testid="project-chat-panel">{projectId}</div>
  ),
}))

describe('AerisRoute', () => {
  it('renders the project chat panel full-page for the given project', async () => {
    const ui = await AerisRoute({ params: Promise.resolve({ id: 'proj-1' }) })

    await act(async () => {
      render(ui)
    })

    expect(screen.getByTestId('project-chat-panel')).toHaveTextContent('proj-1')
  })
})
