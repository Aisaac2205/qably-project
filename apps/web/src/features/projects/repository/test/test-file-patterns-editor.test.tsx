import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { TestFilePatternsEditor } from '../components/test-file-patterns-editor'
import { useI18nStore } from '@/lib/i18n'
import { renderWithQuery } from '@/lib/query-test-utils'

const updateProject = vi.fn()

vi.mock('@/features/projects/api/projects.api', async () => {
  const actual = await vi.importActual<
    typeof import('@/features/projects/api/projects.api')
  >('@/features/projects/api/projects.api')

  return {
    ...actual,
    updateProject: (id: string, payload: unknown) =>
      updateProject(id, payload) ?? Promise.resolve({ id }),
  }
})

function renderEditor(patterns = ['*.spec.ts', '*.test.ts']) {
  return renderWithQuery(
    <TestFilePatternsEditor projectId="project-1" patterns={patterns} />,
  )
}

describe('TestFilePatternsEditor', () => {
  beforeEach(() => {
    updateProject.mockReset()
    updateProject.mockResolvedValue({ id: 'project-1' })
    useI18nStore.setState({ locale: 'en' })
  })

  it('lists the declared patterns without a form until asked', () => {
    renderEditor()

    expect(screen.getByText('*.spec.ts')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /edit test file patterns/i }),
    ).toBeInTheDocument()
  })

  it('gives every pattern a labelled input in edit mode', async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(
      screen.getByRole('button', { name: /edit test file patterns/i }),
    )

    expect(screen.getByLabelText('Pattern 1')).toHaveValue('*.spec.ts')
    expect(screen.getByLabelText('Pattern 2')).toHaveValue('*.test.ts')
  })

  it('saves the edited list and leaves edit mode', async () => {
    const user = userEvent.setup()
    renderEditor(['*.spec.ts'])

    await user.click(
      screen.getByRole('button', { name: /edit test file patterns/i }),
    )
    await user.clear(screen.getByLabelText('Pattern 1'))
    await user.type(screen.getByLabelText('Pattern 1'), '**/*.test.tsx')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(updateProject).toHaveBeenCalledWith('project-1', {
        testFilePatterns: ['**/*.test.tsx'],
      })
    })
    await waitFor(() => {
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })
  })

  it('adds and removes rows', async () => {
    const user = userEvent.setup()
    renderEditor(['*.spec.ts'])

    await user.click(
      screen.getByRole('button', { name: /edit test file patterns/i }),
    )
    await user.click(screen.getByRole('button', { name: /add pattern/i }))

    expect(screen.getByLabelText('Pattern 2')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /remove pattern 2/i }))

    expect(screen.queryByLabelText('Pattern 2')).not.toBeInTheDocument()
  })

  it('refuses a wildcard-only pattern without calling the API', async () => {
    const user = userEvent.setup()
    renderEditor(['*.spec.ts'])

    await user.click(
      screen.getByRole('button', { name: /edit test file patterns/i }),
    )
    await user.clear(screen.getByLabelText('Pattern 1'))
    await user.type(screen.getByLabelText('Pattern 1'), '**')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /at least one character that is not/i,
    )
    expect(updateProject).not.toHaveBeenCalled()
  })

  it('discards the edits on cancel', async () => {
    const user = userEvent.setup()
    renderEditor(['*.spec.ts'])

    await user.click(
      screen.getByRole('button', { name: /edit test file patterns/i }),
    )
    await user.clear(screen.getByLabelText('Pattern 1'))
    await user.type(screen.getByLabelText('Pattern 1'), 'changed.ts')
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(screen.getByText('*.spec.ts')).toBeInTheDocument()
    expect(updateProject).not.toHaveBeenCalled()
  })
})
