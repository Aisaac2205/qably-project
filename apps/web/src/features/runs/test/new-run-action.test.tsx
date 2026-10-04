import type { ComponentProps } from 'react'
import { screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NewRunAction } from '@/features/runs/components/new-run-action'
import { renderWithQuery } from '@/lib/query-test-utils'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)
vi.mock('@/features/runs/api/runs.api', async () =>
  await import('@/test/runs-api-stub'),
)
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

type User = ReturnType<typeof userEvent.setup>

const CLOSERS: [string, (user: User) => Promise<void>][] = [
  ['Cancel', (user) => user.click(screen.getByRole('button', { name: 'Cancel' }))],
  ['Escape', (user) => user.keyboard('{Escape}')],
]

async function renderAction(props: Partial<ComponentProps<typeof NewRunAction>> = {}) {
  await act(async () => {
    renderWithQuery(<NewRunAction projectId="proj-1" disabled={false} {...props} />)
  })
}

function trigger() {
  return screen.getByRole('button', { name: 'New run', hidden: true })
}

async function waitForClose() {
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
}

describe('NewRunAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('when the project has manual cases', () => {
    it('is a dialog trigger button, not a link, and opens the new run dialog', async () => {
      const user = userEvent.setup()
      await renderAction()
      expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog')
      expect(trigger()).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('link', { name: 'New run' })).not.toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      await user.click(trigger())

      expect(await screen.findByRole('dialog', { name: 'New run' })).toBeInTheDocument()
      expect(trigger()).toHaveAttribute('aria-expanded', 'true')
    })

    it.each(CLOSERS)(
      'closes with %s without starting a run and gives focus back to the trigger',
      async (_label, close) => {
        const user = userEvent.setup()
        const api = await import('@/features/runs/api/runs.api')
        const create = vi.spyOn(api, 'createRun')
        await renderAction()
        await user.click(trigger())
        await screen.findByRole('dialog', { name: 'New run' })

        await close(user)

        await waitForClose()
        expect(create).not.toHaveBeenCalled()
        expect(trigger()).toHaveFocus()
      },
    )

    it('starts empty every time it opens', async () => {
      const user = userEvent.setup()
      await renderAction()
      await user.click(trigger())
      await user.type(await screen.findByRole('textbox'), 'Leftover')
      await user.keyboard('{Escape}')
      await waitForClose()

      await user.click(trigger())

      expect(await screen.findByRole('textbox')).toHaveValue('')
    })
  })

  describe('when it starts open', () => {
    it('opens on mount with the requested suite and gives focus back to the trigger on close', async () => {
      const user = userEvent.setup()
      await renderAction({ defaultOpen: true, initialSuiteId: 'suite-2' })

      expect(await screen.findByRole('dialog', { name: 'New run' })).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Suite' })).toHaveTextContent('Checkout')

      await user.keyboard('{Escape}')
      await waitForClose()
      expect(trigger()).toHaveFocus()

      await user.click(trigger())
      expect(await screen.findByRole('combobox', { name: 'Suite' })).toHaveTextContent(
        'Select a suite',
      )
    })

    it('stays closed when it is disabled', async () => {
      await renderAction({ disabled: true, defaultOpen: true, initialSuiteId: 'suite-2' })

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('when the project has no manual cases', () => {
    it('is a disabled button that still takes focus, is described by the hint and opens nothing', async () => {
      const user = userEvent.setup()
      await renderAction({ disabled: true })

      const button = trigger()
      expect(button).toHaveAttribute('aria-disabled', 'true')
      expect(button).not.toHaveAttribute('aria-haspopup')
      expect(button).toHaveAccessibleDescription(
        'Automated cases are fed by CI; add a manual case to a suite to run it here.',
      )

      await user.tab()
      expect(button).toHaveFocus()
      await user.click(button)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
