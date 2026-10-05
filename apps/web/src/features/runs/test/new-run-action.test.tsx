import type { ComponentProps } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, act, waitFor, type RenderResult } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NewRunAction } from '@/features/runs/components/new-run-action'
import { cancelNewRunFocus, requestNewRunFocus } from '@/features/runs/lib/new-run-focus'
import { expectFocusRing } from '@/features/runs/test/focus-ring'
import { createTestQueryClient, renderWithQuery } from '@/lib/query-test-utils'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)
vi.mock('@/features/runs/api/runs.api', async () =>
  await import('@/test/runs-api-stub'),
)
const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
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
    cancelNewRunFocus()
  })

  describe('when the new run route was just closed', () => {
    it('gives focus to its trigger once, and leaves a later visit alone', async () => {
      requestNewRunFocus('proj-1')

      await renderAction()
      expect(trigger()).toHaveFocus()

      cleanup()
      await renderAction()
      expect(trigger()).not.toHaveFocus()
    })

    it('falls back to the main content when it is disabled, since the trigger cannot take the action', async () => {
      requestNewRunFocus('proj-1')

      await act(async () => {
        renderWithQuery(
          <main id="main-content" tabIndex={-1}>
            <NewRunAction projectId="proj-1" disabled />
          </main>,
        )
      })

      expect(screen.getByRole('main')).toHaveFocus()
    })

    it('ignores a request made for another project', async () => {
      requestNewRunFocus('proj-2')

      await renderAction()

      expect(trigger()).not.toHaveFocus()
    })

    it('is not asked for focus by a route-bound instance, which is the one being closed', async () => {
      requestNewRunFocus('proj-1')

      await renderAction({ routeBound: true })

      expect(trigger()).not.toHaveFocus()
    })
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

    it('keeps the default button height and the focus ring recipe', async () => {
      await renderAction()

      expect(trigger()).toHaveClass('h-11', 'md:h-10')
      expectFocusRing(trigger())
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

  describe('when it is bound to the new run route', () => {
    it('opens on mount with the requested suite, gives focus back to the trigger on close and moves the entry to the Manual list address', async () => {
      const user = userEvent.setup()
      await renderAction({ routeBound: true, initialSuiteId: 'suite-2' })

      expect(await screen.findByRole('dialog', { name: 'New run' })).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Suite' })).toHaveTextContent('Checkout')

      await user.keyboard('{Escape}')
      await waitForClose()
      expect(trigger()).toHaveFocus()
      expect(navigation.replace).toHaveBeenCalledTimes(1)
      expect(navigation.replace).toHaveBeenCalledWith('/projects/proj-1/runs?tab=manual', {
        scroll: false,
      })

      await user.click(trigger())
      expect(await screen.findByRole('combobox', { name: 'Suite' })).toHaveTextContent(
        'Select a suite',
      )
      expect(navigation.replace).toHaveBeenCalledTimes(1)
    })

    it('stays closed when it is disabled, and leaves the route for the Manual list address', async () => {
      await renderAction({ disabled: true, routeBound: true, initialSuiteId: 'suite-2' })

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(navigation.replace).toHaveBeenCalledTimes(1)
      expect(navigation.replace).toHaveBeenCalledWith('/projects/proj-1/runs?tab=manual', {
        scroll: false,
      })
    })
  })

  describe('when it is bound to the new run route and the project is still loading', () => {
    function element(client: ReturnType<typeof createTestQueryClient>, props: Partial<ComponentProps<typeof NewRunAction>>) {
      return (
        <QueryClientProvider client={client}>
          <NewRunAction
            projectId="proj-1"
            disabled={false}
            routeBound
            initialSuiteId="suite-2"
            {...props}
          />
        </QueryClientProvider>
      )
    }

    async function mountLoading() {
      const client = createTestQueryClient()
      let view!: RenderResult

      await act(async () => {
        view = render(element(client, { loading: true }))
      })

      return {
        settle: (props: Partial<ComponentProps<typeof NewRunAction>> = {}) =>
          act(async () => {
            view.rerender(element(client, { loading: false, ...props }))
          }),
      }
    }

    it('stays closed until the project has loaded, then opens with the requested suite', async () => {
      const loading = await mountLoading()

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(navigation.replace).not.toHaveBeenCalled()

      await loading.settle()

      expect(await screen.findByRole('dialog', { name: 'New run' })).toBeInTheDocument()
      expect(screen.getByRole('combobox', { name: 'Suite' })).toHaveTextContent('Checkout')
    })

    it('never opens when the project turns out to have no manual cases, and leaves the route', async () => {
      const loading = await mountLoading()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      await loading.settle({ disabled: true })

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(navigation.replace).toHaveBeenCalledTimes(1)
      expect(navigation.replace).toHaveBeenCalledWith('/projects/proj-1/runs?tab=manual', {
        scroll: false,
      })
    })

    it('opens only once, so a dismissed dialog stays closed on later renders', async () => {
      const user = userEvent.setup()
      const loading = await mountLoading()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      await loading.settle()
      await screen.findByRole('dialog', { name: 'New run' })

      await user.keyboard('{Escape}')
      await waitForClose()
      await loading.settle()

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('when it is opened from the runs list', () => {
    it.each(CLOSERS)('leaves history alone when closed with %s', async (_label, close) => {
      const user = userEvent.setup()
      await renderAction()
      await user.click(trigger())
      await screen.findByRole('dialog', { name: 'New run' })

      await close(user)
      await waitForClose()

      expect(navigation.replace).not.toHaveBeenCalled()
      expect(navigation.push).not.toHaveBeenCalled()
    })

    it('never replaces anything while it is disabled', async () => {
      await renderAction({ disabled: true })

      expect(navigation.replace).not.toHaveBeenCalled()
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
