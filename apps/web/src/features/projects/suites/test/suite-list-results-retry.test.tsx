import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { SuiteSummariesPage } from '@qably/types'
import * as suitesApiStub from '@/test/suites-api-stub'
import { EMPTY_PAGE, renderResults } from './suite-list-results-harness'
import { later, rowsFrom } from './suite-list-results-pages'
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

function announcement(): HTMLElement {
  return screen.getByTestId('suite-list-announcement')
}

function failsLater(): Promise<SuiteSummariesPage> {
  return new Promise((_resolve, reject) => setTimeout(() => reject(new Error('down')), 0))
}

function pageOfRows(count: number): SuiteSummariesPage {
  return { items: rowsFrom(0, count), nextCursor: null }
}

describe('SuiteListResults after a first load that failed', () => {
  let listSummaries: MockInstance<typeof suitesApiStub.listSuiteSummaries>

  beforeEach(() => {
    suitesApiStub.__resetSuitesStub()
    listSummaries = vi.spyOn(suitesApiStub, 'listSuiteSummaries')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('when the retry brings suites', () => {
    it('moves the focus from the retry button to the first suite', async () => {
      const user = userEvent.setup()
      listSummaries
        .mockRejectedValueOnce(new Error('down'))
        .mockImplementationOnce(() => later(pageOfRows(3)))
      await renderResults()

      await user.click(await screen.findByRole('button', { name: 'Retry' }))

      await screen.findByTestId('suite-row-s0')
      expect(rowLink('s0')).toHaveFocus()
    })

    it('moves the focus all the same when the retry answers at once', async () => {
      const user = userEvent.setup()
      listSummaries
        .mockRejectedValueOnce(new Error('down'))
        .mockResolvedValueOnce(pageOfRows(3))
      await renderResults()

      await user.click(await screen.findByRole('button', { name: 'Retry' }))

      await screen.findByTestId('suite-row-s0')
      expect(rowLink('s0')).toHaveFocus()
    })

    it.each([
      [3, '3 suites shown'],
      [1, '1 suite shown'],
    ])('announces %s suite(s) as "%s"', async (count, message) => {
      const user = userEvent.setup()
      listSummaries
        .mockRejectedValueOnce(new Error('down'))
        .mockImplementationOnce(() => later(pageOfRows(count)))
      await renderResults()
      expect(announcement()).toBeEmptyDOMElement()

      await user.click(await screen.findByRole('button', { name: 'Retry' }))

      await within(announcement()).findByText(message)
    })

    it('leaves the focus where the user moved it while the retry was on its way', async () => {
      const user = userEvent.setup()
      const pending = deferred<SuiteSummariesPage>()
      const outside = document.createElement('input')
      document.body.append(outside)
      listSummaries
        .mockRejectedValueOnce(new Error('down'))
        .mockImplementationOnce(() => pending.promise)

      try {
        await renderResults()
        await user.click(await screen.findByRole('button', { name: 'Retry' }))

        act(() => outside.focus())
        await act(async () => {
          pending.resolve(pageOfRows(3))
        })

        await screen.findByTestId('suite-row-s0')
        expect(outside).toHaveFocus()
        await within(announcement()).findByText('3 suites shown')
      } finally {
        outside.remove()
      }
    })
  })

  describe('when the retry fails again', () => {
    it('puts the focus back on the error, says nothing, and serves the next retry the same way', async () => {
      const user = userEvent.setup()
      listSummaries
        .mockRejectedValueOnce(new Error('down'))
        .mockImplementationOnce(failsLater)
        .mockImplementationOnce(() => later(pageOfRows(2)))
      await renderResults()

      await user.click(await screen.findByRole('button', { name: 'Retry' }))

      await waitFor(() => expect(screen.getByRole('alert')).toHaveFocus())
      expect(listSummaries).toHaveBeenCalledTimes(2)
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
      expect(announcement()).toBeEmptyDOMElement()

      await user.click(screen.getByRole('button', { name: 'Retry' }))

      await screen.findByTestId('suite-row-s0')
      expect(rowLink('s0')).toHaveFocus()
      await within(announcement()).findByText('2 suites shown')
    })
  })

  describe('when the retry finds nothing to list', () => {
    it('moves the focus to the empty state and announces it', async () => {
      const user = userEvent.setup()
      listSummaries
        .mockRejectedValueOnce(new Error('down'))
        .mockImplementationOnce(() => later(EMPTY_PAGE))
      await renderResults()

      await user.click(await screen.findByRole('button', { name: 'Retry' }))

      const heading = await screen.findByText('No suites yet')
      expect(heading.closest('[tabindex="-1"]')).toHaveFocus()
      await within(announcement()).findByText('0 suites shown')
    })

    it('does the same with the filters that matched nothing', async () => {
      const user = userEvent.setup()
      listSummaries
        .mockRejectedValueOnce(new Error('down'))
        .mockImplementationOnce(() => later(EMPTY_PAGE))
      await renderResults({ filters: { ...NO_FILTERS, search: 'zzz' } })

      await user.click(await screen.findByRole('button', { name: 'Retry' }))

      const heading = await screen.findByText('No suites match your filters')
      expect(heading.closest('[tabindex="-1"]')).toHaveFocus()
      await within(announcement()).findByText('0 suites shown')
    })
  })
})
