import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CiRunsPageRecord } from '@qably/types'
import { CiRunList } from '@/features/runs/components/ci-run-list'
import { listCiRuns } from '@/features/runs/api/ci-runs.api'
import { PROJECT, ciRunSummary } from './ci-run-fixtures'
import { expectEveryFocusableToCarryARing } from './focus-ring'

vi.mock('@/features/runs/api/ci-runs.api', () => ({
  listCiRuns: vi.fn(),
  getCiRun: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const list = vi.mocked(listCiRuns)

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={client}>
      <CiRunList projectId={PROJECT} />
    </QueryClientProvider>,
  )
}

function titles(): string[] {
  const rowsList = within(screen.getByRole('list', { name: 'CI runs' }))
  return rowsList.getAllByText(/^(one|two|three)$/).map((title) => title.textContent ?? '')
}

function page(names: string[], nextCursor?: string): CiRunsPageRecord {
  return {
    items: names.map((name) => ciRunSummary(`id-${name}`, { commitMessage: name })),
    ...(nextCursor === undefined ? {} : { nextCursor }),
  }
}

describe('CiRunList pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('asks for the first page of 25 runs with no cursor', async () => {
    list.mockResolvedValue(page(['one']))

    renderList()

    await screen.findByRole('list', { name: 'CI runs' })
    expect(list).toHaveBeenCalledTimes(1)
    expect(list.mock.calls[0][0]).toStrictEqual({ projectId: PROJECT, limit: 25, cursor: undefined })
  })

  it('offers no way to load more on the last page', async () => {
    list.mockResolvedValue(page(['one', 'two']))

    renderList()

    await screen.findByRole('list', { name: 'CI runs' })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('loads the next page with the cursor received, appends its rows and drops the button on the last page', async () => {
    const user = userEvent.setup()
    list
      .mockResolvedValueOnce(page(['one', 'two'], 'after-two'))
      .mockResolvedValueOnce(page(['three']))

    renderList()

    await screen.findByRole('list', { name: 'CI runs' })
    expect(titles()).toEqual(['one', 'two'])

    await user.click(screen.getByRole('button', { name: 'Load more' }))

    expect(await screen.findByText('three')).toBeInTheDocument()
    expect(titles()).toEqual(['one', 'two', 'three'])
    expect(list).toHaveBeenCalledTimes(2)
    expect(list.mock.calls[1][0]).toStrictEqual({ projectId: PROJECT, limit: 25, cursor: 'after-two' })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps offering to load more while there are more pages', async () => {
    const user = userEvent.setup()
    list
      .mockResolvedValueOnce(page(['one'], 'after-one'))
      .mockResolvedValueOnce(page(['two'], 'after-two'))

    renderList()

    await user.click(await screen.findByRole('button', { name: 'Load more' }))

    expect(await screen.findByText('two')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument()
  })

  it('shows the loading copy and ignores further clicks while the page is in flight', async () => {
    const user = userEvent.setup()
    let resolveNext: (value: CiRunsPageRecord) => void = () => undefined
    list.mockResolvedValueOnce(page(['one'], 'after-one')).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveNext = resolve
      }),
    )

    renderList()

    await user.click(await screen.findByRole('button', { name: 'Load more' }))

    const busy = await screen.findByRole('button', { name: 'Loading…' })
    expect(busy).toHaveAttribute('aria-disabled', 'true')
    expect(busy).toHaveFocus()
    await user.click(busy)
    await user.click(busy)
    expect(list).toHaveBeenCalledTimes(2)

    resolveNext(page(['two']))

    expect(await screen.findByText('two')).toBeInTheDocument()
    expect(titles()).toEqual(['one', 'two'])
  })

  it('keeps the rows loaded and offers a retry when the next page fails', async () => {
    const user = userEvent.setup()
    list
      .mockResolvedValueOnce(page(['one', 'two'], 'after-two'))
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(page(['three']))

    renderList()

    await user.click(await screen.findByRole('button', { name: 'Load more' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load the runs')
    expect(titles()).toEqual(['one', 'two'])
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('three')).toBeInTheDocument()
    expect(list.mock.calls[2][0]).toStrictEqual({ projectId: PROJECT, limit: 25, cursor: 'after-two' })
    expect(titles()).toEqual(['one', 'two', 'three'])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('hides the failure while the retry is in flight', async () => {
    const user = userEvent.setup()
    list
      .mockResolvedValueOnce(page(['one'], 'after-one'))
      .mockRejectedValueOnce(new Error('boom'))
      .mockReturnValueOnce(new Promise(() => undefined))

    renderList()

    await user.click(await screen.findByRole('button', { name: 'Load more' }))
    await user.click(await screen.findByRole('button', { name: 'Retry' }))

    expect(await screen.findByRole('button', { name: 'Loading…' })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('gives the load more button a touch target of at least 44px below md', async () => {
    list.mockResolvedValue(page(['one'], 'after-one'))

    renderList()

    expect(await screen.findByRole('button', { name: 'Load more' })).toHaveClass('h-11')
  })

  it('overrides the faint ring of the button primitive with the primary ring on load more', async () => {
    list.mockResolvedValue(page(['one'], 'after-one'))

    const { container } = renderList()

    expect(await screen.findByRole('button', { name: 'Load more' })).toHaveClass(
      'focus-visible:ring-primary',
    )
    expectEveryFocusableToCarryARing(container, 2)
  })
})
