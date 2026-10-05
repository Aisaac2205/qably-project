import { act, cleanup, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunRecord } from '@qably/types'
import { ApiError } from '@/lib/api-client'
import { parseRunsTab } from '@/features/runs/lib/runs-tab'
import { renderWithQuery } from '@/lib/query-test-utils'
import { RunListPageClient } from '../client'
import NewRunPage from './page'

const navigation = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }))
const project = vi.hoisted(() => ({ hasManualCases: true as boolean | undefined }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navigation.replace, push: navigation.push }),
}))

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)
vi.mock('@/features/runs/api/runs.api', async () => await import('@/test/runs-api-stub'))
vi.mock('@/features/runs/api/ci-runs.api', () => ({
  listCiRuns: vi.fn(),
  getCiRun: vi.fn(),
}))
vi.mock('@/features/projects/hooks/use-project', () => ({
  useProject: () => ({
    project: { id: 'proj-1', name: 'Ecommerce App', hasManualCases: project.hasManualCases },
    isLoading: false,
    isError: false,
  }),
}))

type SearchParams = { suite?: string | string[] }

async function renderPage(searchParams: SearchParams = {}) {
  const element = await NewRunPage({
    params: Promise.resolve({ id: 'proj-1' }),
    searchParams: Promise.resolve(searchParams),
  })

  await act(async () => {
    renderWithQuery(element)
  })
}

function suiteSelect() {
  return screen.getByRole('combobox', { name: 'Suite' })
}

const LIST_URL = '/projects/proj-1/runs?tab=manual'
const RUN_URL = '/projects/proj-1/runs/run-created'

type User = ReturnType<typeof userEvent.setup>

const CLOSERS: [string, (user: User) => Promise<void>][] = [
  ['Escape', (user) => user.keyboard('{Escape}')],
  ['the close button', (user) => user.click(screen.getByRole('button', { name: 'Close' }))],
  [
    'an outside press',
    (user) => user.click(document.querySelector('[data-slot="dialog-overlay"]') as HTMLElement),
  ],
  ['Cancel', (user) => user.click(screen.getByRole('button', { name: 'Cancel' }))],
]

async function holdRequest() {
  const api = await import('@/features/runs/api/runs.api')
  let resolve!: (run: RunRecord) => void
  let reject!: (error: unknown) => void
  vi.spyOn(api, 'createRun').mockReturnValueOnce(
    new Promise<RunRecord>((onResolve, onReject) => {
      resolve = onResolve
      reject = onReject
    }),
  )

  return {
    succeed: () => act(async () => resolve({ id: 'run-created' } as RunRecord)),
    fail: () => act(async () => reject(new ApiError(500, 'boom'))),
  }
}

function modelHistory(entries: string[]) {
  let index = entries.length - 1

  navigation.replace.mockImplementation((href: string) => {
    entries[index] = href
  })
  navigation.push.mockImplementation((href: string) => {
    entries.splice(index + 1)
    entries.push(href)
    index = entries.length - 1
  })

  return {
    entries,
    current: () => entries[index],
    back: () => {
      index -= 1
      return entries[index]
    },
    forward: () => {
      index += 1
      return entries[index]
    },
  }
}

async function mountRoute(url: string) {
  const target = new URL(url, 'http://localhost')

  if (target.pathname.endsWith('/runs/new')) {
    await renderPage({ suite: target.searchParams.get('suite') ?? undefined })
    return
  }

  await act(async () => {
    renderWithQuery(
      <RunListPageClient
        projectId="proj-1"
        initialTab={parseRunsTab(target.searchParams.get('tab'))}
      />,
    )
  })
}

describe('the new run deep link page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navigation.replace.mockReset()
    navigation.push.mockReset()
    project.hasManualCases = true
  })

  it('opens the list on the Manual tab with the new run dialog open and the suite preselected', async () => {
    await renderPage({ suite: 'suite-2' })

    expect(await screen.findByRole('dialog', { name: 'New run' })).toBeInTheDocument()
    expect(suiteSelect()).toHaveTextContent('Checkout')
    expect(screen.getByRole('tab', { name: 'Manual', hidden: true })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('heading', { level: 1, hidden: true })).toHaveTextContent('Runs')
  })

  it('moves focus to the suite select when the dialog opens', async () => {
    await renderPage({ suite: 'suite-1' })

    await screen.findByRole('dialog', { name: 'New run' })
    await waitFor(() => {
      expect(suiteSelect()).toHaveFocus()
    })
  })

  it.each<[string, SearchParams]>([
    ['is absent', {}],
    ['is empty', { suite: '' }],
    ['is repeated', { suite: ['suite-1', 'suite-2'] }],
    ['names a suite that does not exist', { suite: 'suite-gone' }],
  ])('opens the dialog with no suite chosen when the suite %s', async (_label, searchParams) => {
    await renderPage(searchParams)

    expect(await screen.findByRole('dialog', { name: 'New run' })).toBeInTheDocument()
    expect(suiteSelect()).toHaveTextContent('Select a suite')
  })

  it('replaces the new run entry with the run detail once the run is created, so back never reopens the dialog', async () => {
    const user = userEvent.setup()
    const api = await import('@/features/runs/api/runs.api')
    vi.spyOn(api, 'createRun').mockResolvedValueOnce({ id: 'run-created' } as RunRecord)
    await renderPage({ suite: 'suite-2' })
    await screen.findByRole('dialog', { name: 'New run' })

    await user.click(screen.getByRole('button', { name: 'Start run' }))

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/projects/proj-1/runs/run-created')
    })
    expect(navigation.push).not.toHaveBeenCalled()
  })

  it('also replaces the entry when the dialog is closed and opened again on the deep link address', async () => {
    const user = userEvent.setup()
    const api = await import('@/features/runs/api/runs.api')
    vi.spyOn(api, 'createRun').mockResolvedValueOnce({ id: 'run-created' } as RunRecord)
    await renderPage({ suite: 'suite-2' })
    await screen.findByRole('dialog', { name: 'New run' })
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'New run' }))
    await user.click(await screen.findByRole('combobox', { name: 'Suite' }))
    await user.click(await screen.findByRole('option', { name: 'Checkout' }))
    await user.click(screen.getByRole('button', { name: 'Start run' }))

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith('/projects/proj-1/runs/run-created')
    })
    expect(navigation.push).not.toHaveBeenCalled()
  })

  it('closes with Escape, keeps the list and gives focus back to the New run button', async () => {
    const user = userEvent.setup()
    await renderPage({ suite: 'suite-1' })
    await screen.findByRole('dialog', { name: 'New run' })

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(screen.getByRole('tab', { name: 'Manual' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'New run' })).toHaveFocus()
    expect(navigation.replace).toHaveBeenCalledTimes(1)
    expect(navigation.replace).toHaveBeenCalledWith(LIST_URL, { scroll: false })
    expect(navigation.push).not.toHaveBeenCalled()
  })

  it.each(CLOSERS)(
    'replaces the new run entry with the Manual list address when closed with %s, never pushing',
    async (_label, close) => {
      const user = userEvent.setup()
      await renderPage({ suite: 'suite-2' })
      await screen.findByRole('dialog', { name: 'New run' })

      await close(user)

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
      expect(navigation.replace).toHaveBeenCalledTimes(1)
      expect(navigation.replace).toHaveBeenCalledWith(LIST_URL, { scroll: false })
      expect(navigation.push).not.toHaveBeenCalled()
    },
  )

  it('ends on the run detail with exactly one replace, however the user tries to dismiss while the run starts', async () => {
    const user = userEvent.setup()
    const request = await holdRequest()
    await renderPage({ suite: 'suite-2' })
    await screen.findByRole('dialog', { name: 'New run' })
    await user.click(screen.getByRole('button', { name: 'Start run' }))
    await screen.findByRole('button', { name: 'Starting…' })

    for (const [, close] of CLOSERS.slice(0, 3)) await close(user)
    expect(navigation.replace).not.toHaveBeenCalled()

    await request.succeed()
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith(RUN_URL)
    })
    for (const [, close] of CLOSERS.slice(0, 3)) await close(user)
    cleanup()

    expect(navigation.replace).toHaveBeenCalledTimes(1)
    expect(navigation.replace).not.toHaveBeenCalledWith(LIST_URL, expect.anything())
    expect(navigation.push).not.toHaveBeenCalled()
  })

  it('lets the user leave through the Manual list address after a failed start', async () => {
    const user = userEvent.setup()
    const request = await holdRequest()
    await renderPage({ suite: 'suite-2' })
    await screen.findByRole('dialog', { name: 'New run' })
    await user.click(screen.getByRole('button', { name: 'Start run' }))
    await screen.findByRole('button', { name: 'Starting…' })

    await request.fail()
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(navigation.replace).toHaveBeenCalledTimes(1)
    expect(navigation.replace).toHaveBeenCalledWith(LIST_URL, { scroll: false })
  })

  it('leaves the new run address for the list when the project turns out to have no manual cases', async () => {
    project.hasManualCases = false

    await renderPage({ suite: 'suite-1' })

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith(LIST_URL, { scroll: false })
    })
    expect(navigation.replace).toHaveBeenCalledTimes(1)
    expect(navigation.push).not.toHaveBeenCalled()
  })

  describe.each(CLOSERS)('after the dialog is closed with %s', (_label, close) => {
    it('cannot be reopened by going back from a run opened from the list, nor by going forward', async () => {
      const user = userEvent.setup()
      const history = modelHistory([
        '/projects/proj-1/suites/suite-2',
        '/projects/proj-1/runs/new?suite=suite-2',
      ])
      await mountRoute(history.current())
      await screen.findByRole('dialog', { name: 'New run' })

      await close(user)
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
      expect(history.current()).toBe(LIST_URL)

      navigation.push('/projects/proj-1/runs/run-12')
      cleanup()
      await mountRoute(history.back())

      expect(history.current()).toBe(LIST_URL)
      expect(screen.getByRole('tab', { name: 'Manual' })).toHaveAttribute('aria-selected', 'true')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      history.back()
      expect(history.forward()).toBe(LIST_URL)
      cleanup()
      await mountRoute(history.current())

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('keeps the previous page one back step away while the dialog is still open', async () => {
    const history = modelHistory([
      '/projects/proj-1/suites/suite-2',
      '/projects/proj-1/runs/new?suite=suite-2',
    ])

    await mountRoute(history.current())
    await screen.findByRole('dialog', { name: 'New run' })

    expect(history.entries).toHaveLength(2)
    expect(history.back()).toBe('/projects/proj-1/suites/suite-2')
    expect(navigation.replace).not.toHaveBeenCalled()
    expect(navigation.push).not.toHaveBeenCalled()
  })

  it('leaves the deep link address when the user picks the other tab', async () => {
    const user = userEvent.setup()
    await renderPage({ suite: 'suite-1' })
    await screen.findByRole('dialog', { name: 'New run' })
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: 'Actions' }))

    expect(navigation.replace).toHaveBeenCalledWith('/projects/proj-1/runs?tab=actions', {
      scroll: false,
    })
  })

  it('does not open the dialog when the project has no manual cases', async () => {
    project.hasManualCases = false

    await renderPage({ suite: 'suite-1' })

    const button = await screen.findByRole('button', { name: 'New run' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
