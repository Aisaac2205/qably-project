import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { SuiteSummariesPage } from '@qably/types'
import { suiteKeys } from '@/features/projects/lib/query-keys'
import { expectFocusRing } from '@/features/runs/test/focus-ring'
import * as suitesApiStub from '@/test/suites-api-stub'
import { renderResults } from './suite-list-results-harness'
import { later, pagedBy, rowIds, rowsFrom } from './suite-list-results-pages'
import { NO_FILTERS, deferred } from './suite-summaries-test-data'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: React.ReactNode
    [k: string]: unknown
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

function rowLink(id: string): HTMLElement {
  const link = screen.getByTestId(`suite-row-${id}`).closest('a')

  if (link === null) throw new Error(`the row ${id} has no link`)

  return link
}

describe('SuiteListResults loading more', () => {
  let listSummaries: MockInstance<typeof suitesApiStub.listSuiteSummaries>

  beforeEach(() => {
    suitesApiStub.__resetSuitesStub()
    listSummaries = vi.spyOn(suitesApiStub, 'listSuiteSummaries')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('the load more button', () => {
    it('is offered while the last page has a cursor, and only then', async () => {
      const user = userEvent.setup()
      listSummaries.mockImplementation(pagedBy(4, 3))

      await renderResults()

      await user.click(await screen.findByRole('button', { name: 'Load more' }))

      expect(await screen.findByTestId('suite-row-s3')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
    })

    it('offers nothing when the first page is the last one', async () => {
      listSummaries.mockImplementation(pagedBy(3, 3))

      await renderResults()

      await screen.findByTestId('suite-row-s2')
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
    })

    it('asks for the next page with the cursor of the last one and appends its rows', async () => {
      const user = userEvent.setup()
      listSummaries.mockImplementation(pagedBy(7, 3))
      await renderResults()

      await user.click(await screen.findByRole('button', { name: 'Load more' }))

      await screen.findByTestId('suite-row-s5')
      expect(listSummaries).toHaveBeenCalledTimes(2)
      expect(listSummaries.mock.calls[0][0]).toMatchObject({ cursor: undefined })
      expect(listSummaries.mock.calls[1][0]).toMatchObject({ cursor: '3' })
      expect(rowIds()).toEqual(['s0', 's1', 's2', 's3', 's4', 's5'])
    })

    it.each([
      ['Enter', '{Enter}'],
      ['Space', ' '],
    ])('loads the next page with %s', async (_label, keys) => {
      const user = userEvent.setup()
      listSummaries.mockImplementation(pagedBy(7, 3))
      await renderResults()
      const button = await screen.findByRole('button', { name: 'Load more' })

      act(() => button.focus())
      await user.keyboard(keys)

      await screen.findByTestId('suite-row-s5')
      expect(listSummaries.mock.calls[1][0]).toMatchObject({ cursor: '3' })
    })

    it('shows the loading label, keeps the focus and ignores clicks while the page is in flight', async () => {
      const user = userEvent.setup()
      const second = deferred<SuiteSummariesPage>()
      listSummaries
        .mockImplementationOnce(pagedBy(7, 3))
        .mockImplementationOnce(() => second.promise)
      await renderResults()

      await user.click(await screen.findByRole('button', { name: 'Load more' }))

      const busy = await screen.findByRole('button', { name: 'Loading more…' })
      expect(busy).toHaveAttribute('aria-disabled', 'true')
      expect(busy).toHaveFocus()
      await user.click(busy)
      await user.click(busy)
      expect(listSummaries).toHaveBeenCalledTimes(2)

      await act(async () => {
        second.resolve({ items: rowsFrom(3, 6), nextCursor: '6' })
      })

      expect(await screen.findByRole('button', { name: 'Load more' })).toBeInTheDocument()
      expect(rowIds()).toEqual(['s0', 's1', 's2', 's3', 's4', 's5'])
    })

    it('never loads by itself, whatever the scroll', async () => {
      const observer = vi.fn()
      vi.stubGlobal('IntersectionObserver', observer)
      listSummaries.mockImplementation(pagedBy(7, 3))
      await renderResults()
      await screen.findByRole('button', { name: 'Load more' })

      fireEvent.scroll(window, { target: { scrollY: 5000 } })

      expect(observer).not.toHaveBeenCalled()
      expect(listSummaries).toHaveBeenCalledTimes(1)
      expect(rowIds()).toEqual(['s0', 's1', 's2'])
    })

    it('is hidden while the rows on screen belong to the previous filters', async () => {
      const pending = deferred<SuiteSummariesPage>()
      listSummaries.mockImplementation(pagedBy(7, 3))
      const { rerenderWith } = await renderResults()
      await screen.findByRole('button', { name: 'Load more' })
      listSummaries.mockImplementationOnce(() => pending.promise)

      await rerenderWith({ filters: { ...NO_FILTERS, search: 'abc' } })

      expect(rowIds()).toEqual(['s0', 's1', 's2'])
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
    })

    it('renders a suite that shows up in two pages once, with no duplicate key warning', async () => {
      const user = userEvent.setup()
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      listSummaries
        .mockImplementationOnce(() => later({ items: rowsFrom(0, 3), nextCursor: '3' }))
        .mockImplementationOnce(() => later({ items: rowsFrom(2, 5), nextCursor: null }))
      await renderResults()

      await user.click(await screen.findByRole('button', { name: 'Load more' }))

      await screen.findByTestId('suite-row-s4')
      expect(rowIds()).toEqual(['s0', 's1', 's2', 's3', 's4'])
      const keyWarnings = consoleError.mock.calls.filter((call) =>
        String(call[0]).includes('same key'),
      )
      expect(keyWarnings).toHaveLength(0)
    })

    it('keeps the rows and offers a retry when the next page fails, then repeats that page', async () => {
      const user = userEvent.setup()
      listSummaries
        .mockImplementationOnce(pagedBy(7, 3))
        .mockRejectedValueOnce(new Error('down'))
        .mockImplementationOnce(pagedBy(7, 3))
      await renderResults()

      await user.click(await screen.findByRole('button', { name: 'Load more' }))

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Could not load suites.')
      expect(rowIds()).toEqual(['s0', 's1', 's2'])
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Retry' }))

      await screen.findByTestId('suite-row-s5')
      expect(listSummaries.mock.calls[2][0]).toMatchObject({ cursor: '3' })
      expect(rowIds()).toEqual(['s0', 's1', 's2', 's3', 's4', 's5'])
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('is full width below sm, 44 px tall below md and carries the focus ring of the repo', async () => {
      listSummaries.mockImplementation(pagedBy(7, 3))
      await renderResults()

      const button = await screen.findByRole('button', { name: 'Load more' })

      expect(button).toHaveClass('h-11', 'w-full', 'sm:w-auto')
      expectFocusRing(button)
    })
  })

  describe('the focus after loading more', () => {
    it('moves from the button to the first new row once the page lands', async () => {
      const user = userEvent.setup()
      listSummaries.mockImplementation(pagedBy(7, 3))
      await renderResults()

      await user.click(await screen.findByRole('button', { name: 'Load more' }))

      await screen.findByTestId('suite-row-s3')
      expect(rowLink('s3')).toHaveFocus()
    })

    it('moves to the first new row when the load was started from the keyboard', async () => {
      const user = userEvent.setup()
      listSummaries.mockImplementation(pagedBy(7, 3))
      await renderResults()
      const button = await screen.findByRole('button', { name: 'Load more' })

      act(() => button.focus())
      await user.keyboard('{Enter}')

      await screen.findByTestId('suite-row-s3')
      expect(rowLink('s3')).toHaveFocus()
    })

    it('lands on the first new row of the last page, when the button leaves with it', async () => {
      const user = userEvent.setup()
      listSummaries.mockImplementation(pagedBy(4, 3))
      await renderResults()

      await user.click(await screen.findByRole('button', { name: 'Load more' }))

      await screen.findByTestId('suite-row-s3')
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
      expect(rowLink('s3')).toHaveFocus()
    })

    it('does not take the focus from where the user moved it while the page loaded', async () => {
      const user = userEvent.setup()
      const second = deferred<SuiteSummariesPage>()
      const outside = document.createElement('input')
      document.body.append(outside)
      listSummaries
        .mockImplementationOnce(pagedBy(7, 3))
        .mockImplementationOnce(() => second.promise)

      try {
        await renderResults()
        await user.click(await screen.findByRole('button', { name: 'Load more' }))

        act(() => outside.focus())
        await act(async () => {
          second.resolve({ items: rowsFrom(3, 6), nextCursor: '6' })
        })

        await screen.findByTestId('suite-row-s5')
        expect(outside).toHaveFocus()
      } finally {
        outside.remove()
      }
    })

    it('goes to the list when the last page brings no new row and the button is gone', async () => {
      const user = userEvent.setup()
      listSummaries
        .mockImplementationOnce(() => later({ items: rowsFrom(0, 3), nextCursor: '3' }))
        .mockImplementationOnce(() => later({ items: rowsFrom(1, 2), nextCursor: null }))
      await renderResults()

      await user.click(await screen.findByRole('button', { name: 'Load more' }))

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
      })
      const list = screen.getByRole('list', { name: 'Suites' })
      await waitFor(() => expect(list).toHaveFocus())
      expect(list).toHaveAttribute('tabindex', '-1')
      expect(rowIds()).toEqual(['s0', 's1', 's2'])
    })
  })

  describe('when the next page answers at once', () => {
    it('still moves the focus from the button to the first new row', async () => {
      const user = userEvent.setup()
      listSummaries
        .mockResolvedValueOnce({ items: rowsFrom(0, 3), nextCursor: '3' })
        .mockResolvedValueOnce({ items: rowsFrom(3, 6), nextCursor: null })
      await renderResults()

      await user.click(await screen.findByRole('button', { name: 'Load more' }))

      await screen.findByTestId('suite-row-s3')
      expect(rowLink('s3')).toHaveFocus()
    })

    it('leaves the focus alone on a later refresh when the page only repeated rows', async () => {
      const user = userEvent.setup()
      listSummaries
        .mockResolvedValueOnce({ items: rowsFrom(0, 3), nextCursor: '3' })
        .mockResolvedValueOnce({ items: rowsFrom(1, 3), nextCursor: '5' })
      const { client } = await renderResults()
      await user.click(await screen.findByRole('button', { name: 'Load more' }))
      await waitFor(() => {
        const data = client.getQueryData<{ pages: unknown[] }>(
          suiteKeys.summaryPage('proj-1', { sort: 'recent' }),
        )

        expect(data?.pages).toHaveLength(2)
      })
      const button = screen.getByRole('button', { name: 'Load more' })
      expect(button).toHaveFocus()
      listSummaries
        .mockResolvedValueOnce({ items: rowsFrom(0, 4), nextCursor: '4' })
        .mockResolvedValueOnce({ items: rowsFrom(4, 6), nextCursor: '6' })

      await act(async () => {
        await client.invalidateQueries({ queryKey: suiteKeys.summaries('proj-1') })
      })

      await screen.findByTestId('suite-row-s5')
      expect(rowIds()).toEqual(['s0', 's1', 's2', 's3', 's4', 's5'])
      expect(screen.getByRole('button', { name: 'Load more' })).toHaveFocus()
    })
  })
})
