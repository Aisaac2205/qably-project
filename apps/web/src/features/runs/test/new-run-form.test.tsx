import type { ComponentProps } from 'react'
import { screen, act, waitFor, within, createEvent, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RunRecord } from '@qably/types'
import { Dialog } from '@/components/ui/dialog'
import { NewRunForm } from '@/features/runs/components/new-run-form'
import { expectFocusRing } from '@/features/runs/test/focus-ring'
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
    expect(await screen.findByText(/No suites available/)).toBeInTheDocument()
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
      await waitFor(() => {
        expect(dialog).toHaveAccessibleDescription('No suites available. Create a suite first.')
      })
      expect(within(dialog).queryByRole('button', { name: 'Start run' })).not.toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
    })

    it('moves focus to the first field when it opens', async () => {
      await openForm()

      await waitFor(() => {
        expect(screen.getByRole('combobox', { name: 'Suite' })).toHaveFocus()
      })
    })

    it('keeps focus inside the dialog while tabbing past its last control', async () => {
      const user = userEvent.setup()
      await openForm()
      const dialog = screen.getByRole('dialog', { name: 'New run' })
      await waitFor(() => {
        expect(dialog).toContainElement(document.activeElement as HTMLElement)
      })

      for (let press = 0; press < 8; press += 1) {
        await user.tab()
        await waitFor(() => {
          expect(dialog).toContainElement(document.activeElement as HTMLElement)
        })
      }
    })

    it('focuses the suite select even while the suites are still loading', async () => {
      const suitesApi = await import('@/features/projects/suites/api/suites.api')
      vi.spyOn(suitesApi, 'listSuites').mockReturnValueOnce(new Promise(() => undefined))

      await openForm({ projectId: 'proj-unseeded' })

      const select = screen.getByRole('combobox', { name: 'Suite' })
      expect(select).not.toBeDisabled()
      await waitFor(() => {
        expect(select).toHaveFocus()
      })
      expect(screen.getByRole('button', { name: 'Start run' })).toHaveAttribute(
        'aria-disabled',
        'true',
      )
      expect(screen.queryByText(/No suites available/)).not.toBeInTheDocument()
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

  describe('while the run is starting', () => {
    it('disables the submit button, shows the spinner and starts only one run', async () => {
      const user = userEvent.setup()
      const api = await import('@/features/runs/api/runs.api')
      const create = vi
        .spyOn(api, 'createRun')
        .mockReturnValueOnce(new Promise<RunRecord>(() => undefined))

      await openForm({ initialSuiteId: 'suite-1' })
      await user.click(screen.getByRole('button', { name: 'Start run' }))

      const submit = await screen.findByRole('button', { name: 'Starting…' })
      expect(submit).toHaveAttribute('aria-disabled', 'true')
      expect(submit.querySelector('.spinner')).not.toBeNull()
      expect(screen.queryByRole('button', { name: 'Start run' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()

      await user.click(submit)
      const form = screen.getByRole('textbox', { name: /run name/i }).closest('form') as HTMLFormElement
      await act(async () => {
        fireEvent.submit(form)
      })
      expect(create).toHaveBeenCalledTimes(1)
    })

    it('enables the submit button again and announces the error when the request fails', async () => {
      const user = userEvent.setup()
      const api = await import('@/features/runs/api/runs.api')
      vi.spyOn(api, 'createRun').mockRejectedValueOnce(new ApiError(500, 'boom'))

      await openForm({ initialSuiteId: 'suite-1' })
      await user.click(screen.getByRole('button', { name: 'Start run' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Could not start the run. Please try again.')
      const submit = screen.getByRole('button', { name: 'Start run' })
      expect(submit).not.toHaveAttribute('aria-disabled', 'true')
      expect(submit.querySelector('.spinner')).toBeNull()
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    })

    it('lets the user retry after a failure', async () => {
      const user = userEvent.setup()
      const api = await import('@/features/runs/api/runs.api')
      const create = vi
        .spyOn(api, 'createRun')
        .mockRejectedValueOnce(new ApiError(500, 'boom'))
        .mockResolvedValueOnce({ id: 'run-created' } as RunRecord)

      await openForm({ initialSuiteId: 'suite-1' })
      await user.click(screen.getByRole('button', { name: 'Start run' }))
      await screen.findByRole('alert')
      await user.click(screen.getByRole('button', { name: 'Start run' }))

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/runs/run-created')
      })
      expect(create).toHaveBeenCalledTimes(2)
    })
  })

  describe('touch targets, text size and focus', () => {
    it('sizes every control 44px below md and 40px from md with 16px text on mobile', async () => {
      await openForm()

      const select = screen.getByRole('combobox', { name: 'Suite' })
      const input = screen.getByRole('textbox', { name: /run name/i })
      expect(input).toHaveClass('h-11', 'md:h-10')
      expect(input).not.toHaveClass('h-10')
      expect(select).toHaveClass('min-h-11', 'md:min-h-10')
      const selected = select.querySelector('[data-slot="select-value"]')
      for (const control of [select, input, selected]) {
        expect(control).toHaveClass('text-base', 'md:text-sm')
        expect(control).not.toHaveClass('text-xs', 'text-sm')
      }
      for (const name of ['Cancel', 'Start run']) {
        expect(screen.getByRole('button', { name })).toHaveClass('h-11', 'md:h-10')
      }
    })

    it('lets a long suite name wrap inside the select and inside its options', async () => {
      const user = userEvent.setup()
      await openForm()

      const select = screen.getByRole('combobox', { name: 'Suite' })
      expect(select).toHaveClass(
        'h-auto',
        'md:h-auto',
        '[&>span]:line-clamp-none',
        '[&>span]:wrap-anywhere',
      )
      expect(select).not.toHaveClass('h-11', 'md:h-10', '[&>span]:line-clamp-1')

      await user.click(select)
      const option = await screen.findByRole('option', { name: 'Authentication' })
      expect(option).toHaveClass('min-h-11', 'md:min-h-0', 'wrap-anywhere', 'text-base', 'md:text-sm')
    })

    it('carries the focus ring recipe on the select, the name input and both buttons', async () => {
      await openForm()

      expect(screen.getByRole('combobox', { name: 'Suite' })).toHaveClass(
        'focus-visible:outline-hidden!',
        'focus-visible:ring-2',
        'focus-visible:ring-primary',
        'focus-visible:ring-offset-2',
        'focus-visible:ring-offset-background',
      )
      expectFocusRing(screen.getByRole('textbox', { name: /run name/i }))
      expectFocusRing(screen.getByRole('button', { name: 'Cancel' }))
      expectFocusRing(screen.getByRole('button', { name: 'Start run' }))
    })
  })
})
