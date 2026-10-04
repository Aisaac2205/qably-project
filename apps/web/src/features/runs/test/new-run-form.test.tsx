import type { ComponentProps } from 'react'
import { screen, act, waitFor, within, createEvent, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RunRecord } from '@qably/types'
import { Dialog } from '@/components/ui/dialog'
import { NewRunForm } from '@/features/runs/components/new-run-form'
import { renderWithQuery } from '@/lib/query-test-utils'
import { ApiError } from '@/lib/api-client'

const mockPush = vi.hoisted(() => vi.fn())

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)
vi.mock('@/features/runs/api/runs.api', async () =>
  await import('@/test/runs-api-stub'),
)

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

async function openForm(props: Partial<ComponentProps<typeof NewRunForm>> = {}) {
  await act(async () => {
    renderWithQuery(
      <Dialog open>
        <NewRunForm projectId="proj-1" {...props} />
      </Dialog>,
    )
  })
}

describe('NewRunForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders suite select', async () => {
    await openForm()
    // Uses Select component; the trigger should render
    expect(screen.getByText('Select a suite')).toBeInTheDocument()
  })

  it('renders optional name input', async () => {
    await openForm()
    const input = screen.getByPlaceholderText('e.g. Smoke Test')
    expect(input).toBeInTheDocument()
  })

  it('renders submit button', async () => {
    await openForm()
    expect(screen.getByRole('button', { name: 'Start run' })).toBeInTheDocument()
  })

  it('shows error when submitting without suite', async () => {
    const user = userEvent.setup()
    await openForm()
    await user.click(screen.getByRole('button', { name: 'Start run' }))
    expect(screen.getByText('Please select a suite')).toBeInTheDocument()
  })

  it('translates a raw backend empty-suite error instead of rendering it verbatim', async () => {
    const user = userEvent.setup()
    const api = await import('@/features/runs/api/runs.api')
    vi.spyOn(api, 'createRun').mockRejectedValueOnce(
      new ApiError(400, 'Cannot start a run from a suite with no cases'),
    )

    await openForm()
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('Authentication'))
    await user.click(screen.getByRole('button', { name: 'Start run' }))

    await waitFor(() => {
      expect(
        screen.getByText('Add at least one test case before running this suite'),
      ).toBeInTheDocument()
    })
    expect(
      screen.queryByText('Cannot start a run from a suite with no cases'),
    ).not.toBeInTheDocument()
  })

  it('maps the 409 no-manual-cases error to a dedicated message instead of the generic one', async () => {
    const user = userEvent.setup()
    const api = await import('@/features/runs/api/runs.api')
    vi.spyOn(api, 'createRun').mockRejectedValueOnce(
      new ApiError(
        409,
        'This suite has no manual cases to run; automated cases are read-only here',
        'no-manual-cases',
      ),
    )

    await openForm()
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('Authentication'))
    await user.click(screen.getByRole('button', { name: 'Start run' }))

    await waitFor(() => {
      expect(
        screen.getByText(/no manual cases to run/i),
      ).toBeInTheDocument()
    })
    expect(screen.queryByText('Could not start the run. Please try again.')).not.toBeInTheDocument()
    expect(screen.queryByText('no-manual-cases')).not.toBeInTheDocument()
  })

  it('translates an unknown backend error into a generic message', async () => {
    const user = userEvent.setup()
    const api = await import('@/features/runs/api/runs.api')
    vi.spyOn(api, 'createRun').mockRejectedValueOnce(new ApiError(500, 'boom'))

    await openForm()
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('Authentication'))
    await user.click(screen.getByRole('button', { name: 'Start run' }))

    await waitFor(() => {
      expect(
        screen.getByText('Could not start the run. Please try again.'),
      ).toBeInTheDocument()
    })
    expect(screen.queryByText('boom')).not.toBeInTheDocument()
  })

  it('shows empty state when no suites', async () => {
    await openForm({ projectId: 'proj-4' })
    // proj-4 has 0 suites in mock data
    expect(screen.getByText(/No suites available/)).toBeInTheDocument()
  })

  it('shows heading', async () => {
    await openForm()
    expect(screen.getByText('New run')).toBeInTheDocument()
  })

  describe('as a dialog', () => {
    it('is a dialog named New run and described by what a run records', async () => {
      await openForm()

      const dialog = screen.getByRole('dialog', { name: 'New run' })
      expect(dialog).toHaveAccessibleDescription(
        'Select a suite to record a result for each of its manual cases.',
      )
    })

    it('describes the dialog with the no suites message and offers only Cancel when the project has no suites', async () => {
      await openForm({ projectId: 'proj-4' })

      const dialog = screen.getByRole('dialog', { name: 'New run' })
      expect(dialog).toHaveAccessibleDescription('No suites available. Create a suite first.')
      expect(within(dialog).queryByRole('button', { name: 'Start run' })).not.toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('moves focus to the first field when it opens', async () => {
      await openForm()

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: 'Suite' })).toHaveFocus()
      })
    })

    it('labels the suite select and the optional name', async () => {
      await openForm()

      expect(screen.getByRole('combobox', { name: 'Suite' })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'Run name (optional)' })).toBeInTheDocument()
    })
  })

  describe('creating a run', () => {
    it('starts the run for the chosen suite and name, then opens its detail', async () => {
      const user = userEvent.setup()
      const api = await import('@/features/runs/api/runs.api')
      const create = vi
        .spyOn(api, 'createRun')
        .mockResolvedValueOnce({ id: 'run-created' } as RunRecord)

      await openForm()
      await user.click(screen.getByRole('combobox'))
      await user.click(await screen.findByText('Checkout'))
      await user.type(screen.getByPlaceholderText('e.g. Smoke Test'), 'Smoke')
      await user.click(screen.getByRole('button', { name: 'Start run' }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/runs/run-created')
      })
      expect(create).toHaveBeenCalledTimes(1)
      expect(create).toHaveBeenCalledWith({
        projectId: 'proj-1',
        suiteId: 'suite-2',
        name: 'Smoke',
      })
    })

    it('sends no name when the optional field is blank', async () => {
      const user = userEvent.setup()
      const api = await import('@/features/runs/api/runs.api')
      const create = vi
        .spyOn(api, 'createRun')
        .mockResolvedValueOnce({ id: 'run-created' } as RunRecord)

      await openForm({ initialSuiteId: 'suite-1' })
      await user.click(screen.getByRole('button', { name: 'Start run' }))

      await waitFor(() => {
        expect(create).toHaveBeenCalledWith({
          projectId: 'proj-1',
          suiteId: 'suite-1',
          name: undefined,
        })
      })
    })

    it('submits from the keyboard with Enter in the name field', async () => {
      const user = userEvent.setup()
      const api = await import('@/features/runs/api/runs.api')
      const create = vi
        .spyOn(api, 'createRun')
        .mockResolvedValueOnce({ id: 'run-created' } as RunRecord)

      await openForm({ initialSuiteId: 'suite-1' })
      await user.type(screen.getByRole('textbox', { name: /run name/i }), 'Nightly{Enter}')

      await waitFor(() => {
        expect(create).toHaveBeenCalledWith({
          projectId: 'proj-1',
          suiteId: 'suite-1',
          name: 'Nightly',
        })
      })
    })

    it('keeps the browser from reloading the page when the form is submitted', async () => {
      await openForm({ initialSuiteId: 'suite-1' })
      const form = screen.getByRole('textbox', { name: /run name/i }).closest('form') as HTMLFormElement
      const submit = createEvent.submit(form)

      fireEvent(form, submit)

      expect(submit.defaultPrevented).toBe(true)
    })

    it('does not start a run without a suite, even from the keyboard', async () => {
      const user = userEvent.setup()
      const api = await import('@/features/runs/api/runs.api')
      const create = vi.spyOn(api, 'createRun')

      await openForm()
      await user.type(screen.getByRole('textbox', { name: /run name/i }), 'Nightly{Enter}')

      expect(create).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent('Please select a suite')
    })
  })

  describe('errors and fields', () => {
    it('announces the missing suite and ties it to the select', async () => {
      const user = userEvent.setup()
      await openForm()

      await user.click(screen.getByRole('button', { name: 'Start run' }))

      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent('Please select a suite')
      const select = screen.getByRole('combobox', { name: 'Suite' })
      expect(select).toHaveAttribute('aria-invalid', 'true')
      expect(select).toHaveAccessibleDescription('Please select a suite')
    })

    it('clears the error once a suite is chosen', async () => {
      const user = userEvent.setup()
      await openForm()
      await user.click(screen.getByRole('button', { name: 'Start run' }))
      expect(screen.getByRole('alert')).toBeInTheDocument()

      await user.click(screen.getByRole('combobox'))
      await user.click(await screen.findByText('Authentication'))

      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Suite' })).not.toHaveAttribute(
        'aria-invalid',
        'true',
      )
    })

    it('preselects a known suite', async () => {
      await openForm({ initialSuiteId: 'suite-2' })

      expect(screen.getByRole('combobox', { name: 'Suite' })).toHaveTextContent('Checkout')
    })

    it('ignores a preselected suite that does not exist in the project', async () => {
      const user = userEvent.setup()
      const api = await import('@/features/runs/api/runs.api')
      const create = vi.spyOn(api, 'createRun')

      await openForm({ initialSuiteId: 'suite-missing' })

      expect(screen.getByRole('combobox', { name: 'Suite' })).toHaveTextContent('Select a suite')
      await user.click(screen.getByRole('button', { name: 'Start run' }))
      expect(create).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent('Please select a suite')
    })
  })
})
