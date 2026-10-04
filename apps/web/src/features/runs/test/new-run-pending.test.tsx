import { render, screen, act, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RunRecord } from '@qably/types'
import { NewRunAction } from '@/features/runs/components/new-run-action'
import { createTestQueryClient, renderWithQuery } from '@/lib/query-test-utils'
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

type User = ReturnType<typeof userEvent.setup>

const RUN_URL = '/projects/proj-1/runs/run-created'

const DISMISSERS: [string, (user: User) => Promise<void>][] = [
  ['Escape', (user) => user.keyboard('{Escape}')],
  ['an outside press', (user) => user.click(document.querySelector('[data-slot="dialog-overlay"]') as HTMLElement)],
  ['the close button', (user) => user.click(screen.getByRole('button', { name: 'Close' }))],
]

async function holdRequest() {
  const api = await import('@/features/runs/api/runs.api')
  let resolve!: (run: RunRecord) => void
  let reject!: (error: unknown) => void
  const create = vi.spyOn(api, 'createRun').mockReturnValueOnce(
    new Promise<RunRecord>((onResolve, onReject) => {
      resolve = onResolve
      reject = onReject
    }),
  )
  return {
    create,
    succeed: () => act(async () => resolve({ id: 'run-created' } as RunRecord)),
    fail: () => act(async () => reject(new ApiError(500, 'boom'))),
  }
}

async function startPendingRun() {
  const user = userEvent.setup()
  const request = await holdRequest()
  await act(async () => {
    renderWithQuery(
      <NewRunAction projectId="proj-1" disabled={false} defaultOpen initialSuiteId="suite-1" />,
    )
  })
  await user.click(await screen.findByRole('button', { name: 'Start run' }))
  await screen.findByRole('button', { name: 'Starting…' })
  return { user, ...request }
}

async function expectStaysOpen() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150))
  })
  expect(screen.getByRole('dialog', { name: 'New run' })).toBeInTheDocument()
}

describe('NewRunAction while the run is starting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe.each(DISMISSERS)('when the user tries to dismiss with %s', (_label, dismiss) => {
    it('keeps the dialog open and starts no second run', async () => {
      const { user, create } = await startPendingRun()

      await dismiss(user)

      await expectStaysOpen()
      expect(create).toHaveBeenCalledTimes(1)
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('opens the new run once when the request resolves', async () => {
      const { user, succeed } = await startPendingRun()
      await dismiss(user)

      await succeed()

      await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
      expect(mockPush).toHaveBeenCalledWith(RUN_URL)
    })

    it('shows the error in the dialog when the request fails and lets the user dismiss again', async () => {
      const { user, fail } = await startPendingRun()
      await dismiss(user)

      await fail()

      const dialog = await screen.findByRole('dialog', { name: 'New run' })
      expect(await within(dialog).findByRole('alert')).toHaveTextContent(
        'Could not start the run. Please try again.',
      )
      expect(mockPush).not.toHaveBeenCalled()

      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })
  })

  it('opens the new run exactly once when nothing tries to dismiss the dialog', async () => {
    const { succeed } = await startPendingRun()

    await succeed()

    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
    expect(mockPush).toHaveBeenCalledWith(RUN_URL)
  })

  it('disables Cancel and the close button while the request is pending', async () => {
    await startPendingRun()

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
  })

  it('enables Cancel and the close button again when the request fails', async () => {
    const { fail } = await startPendingRun()

    await fail()

    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled()
  })

  it('closes with the close button after a failure and gives the trigger focus back', async () => {
    const { user, fail } = await startPendingRun()
    await fail()
    await screen.findByRole('alert')

    await user.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'New run', hidden: true })).toHaveFocus()
  })

  it('lets the user start again after a failed request and dismiss only after that one ends', async () => {
    const { user, fail } = await startPendingRun()
    await fail()
    await screen.findByRole('alert')
    const api = await import('@/features/runs/api/runs.api')
    vi.spyOn(api, 'createRun').mockReturnValueOnce(new Promise<RunRecord>(() => undefined))

    await user.click(screen.getByRole('button', { name: 'Start run' }))
    await screen.findByRole('button', { name: 'Starting…' })
    await user.keyboard('{Escape}')

    await expectStaysOpen()
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled()
  })

  it('does not stay undismissable when the form goes away mid-request and comes back', async () => {
    const user = userEvent.setup()
    const api = await import('@/features/runs/api/runs.api')
    vi.spyOn(api, 'createRun').mockReturnValueOnce(new Promise<RunRecord>(() => undefined))
    const client = createTestQueryClient()
    const action = (disabled: boolean) => (
      <QueryClientProvider client={client}>
        <NewRunAction projectId="proj-1" disabled={disabled} defaultOpen initialSuiteId="suite-1" />
      </QueryClientProvider>
    )
    let view!: ReturnType<typeof render>
    await act(async () => {
      view = render(action(false))
    })
    await user.click(await screen.findByRole('button', { name: 'Start run' }))
    await screen.findByRole('button', { name: 'Starting…' })

    await act(async () => view.rerender(action(true)))
    await act(async () => view.rerender(action(false)))

    await screen.findByRole('dialog', { name: 'New run' })
    expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('does not block dismissing a dialog nothing was submitted from', async () => {
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(<NewRunAction projectId="proj-1" disabled={false} defaultOpen />)
    })
    await screen.findByRole('dialog', { name: 'New run' })
    expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled()

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})
