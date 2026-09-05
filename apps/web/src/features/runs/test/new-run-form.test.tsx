import { screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NewRunForm } from '@/features/runs/components/new-run-form'
import { renderWithQuery } from '@/lib/query-test-utils'
import { ApiError } from '@/lib/api-client'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)
vi.mock('@/features/runs/api/runs.api', async () =>
  await import('@/test/runs-api-stub'),
)

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('NewRunForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders suite select', async () => {
    await act(async () => {
      renderWithQuery(<NewRunForm projectId="proj-1" />)
    })
    // Uses Select component; the trigger should render
    expect(screen.getByText('Select a suite')).toBeInTheDocument()
  })

  it('renders optional name input', async () => {
    await act(async () => {
      renderWithQuery(<NewRunForm projectId="proj-1" />)
    })
    const input = screen.getByPlaceholderText('e.g. Smoke Test')
    expect(input).toBeInTheDocument()
  })

  it('renders submit button', async () => {
    await act(async () => {
      renderWithQuery(<NewRunForm projectId="proj-1" />)
    })
    expect(screen.getByRole('button', { name: 'Start run' })).toBeInTheDocument()
  })

  it('shows error when submitting without suite', async () => {
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(<NewRunForm projectId="proj-1" />)
    })
    await user.click(screen.getByRole('button', { name: 'Start run' }))
    expect(screen.getByText('Please select a suite')).toBeInTheDocument()
  })

  it('translates a raw backend empty-suite error instead of rendering it verbatim', async () => {
    const user = userEvent.setup()
    const api = await import('@/features/runs/api/runs.api')
    vi.spyOn(api, 'createRun').mockRejectedValueOnce(
      new ApiError(400, 'Cannot start a run from a suite with no cases'),
    )

    await act(async () => {
      renderWithQuery(<NewRunForm projectId="proj-1" />)
    })
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

  it('translates an unknown backend error into a generic message', async () => {
    const user = userEvent.setup()
    const api = await import('@/features/runs/api/runs.api')
    vi.spyOn(api, 'createRun').mockRejectedValueOnce(new ApiError(500, 'boom'))

    await act(async () => {
      renderWithQuery(<NewRunForm projectId="proj-1" />)
    })
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
    await act(async () => {
      renderWithQuery(<NewRunForm projectId="proj-4" />)
    })
    // proj-4 has 0 suites in mock data
    expect(screen.getByText(/No suites available/)).toBeInTheDocument()
  })

  it('shows heading', async () => {
    await act(async () => {
      renderWithQuery(<NewRunForm projectId="proj-1" />)
    })
    expect(screen.getByText('New run')).toBeInTheDocument()
  })
})
