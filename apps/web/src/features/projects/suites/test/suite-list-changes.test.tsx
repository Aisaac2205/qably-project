import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { SuiteSummariesPage } from '@qably/types'
import * as suitesApiStub from '@/test/suites-api-stub'
import { renderList, resultsArea } from './suite-list-harness'
import { later, pagedBy, rowIds, rowsFrom } from './suite-list-results-pages'
import { deferred } from './suite-summaries-test-data'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)
vi.mock('@/features/runs/api/runs.api', async () =>
  await import('@/test/runs-api-stub'),
)

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('SuiteList while the results change', () => {
  let listSummaries: MockInstance<typeof suitesApiStub.listSuiteSummaries>

  beforeEach(() => {
    suitesApiStub.__resetSuitesStub()
    listSummaries = vi.spyOn(suitesApiStub, 'listSuiteSummaries')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the search text and its focus, and marks the area busy, while the answer is pending', async () => {
    const user = userEvent.setup()
    await renderList()
    await screen.findByTestId('suite-row-suite-4')
    const pending = deferred<SuiteSummariesPage>()
    listSummaries.mockImplementationOnce(() => pending.promise)
    const input = screen.getByTestId('suite-search')

    await user.type(input, 'abc')
    await waitFor(() => expect(listSummaries).toHaveBeenCalledTimes(2))

    expect(input).toHaveValue('abc')
    expect(input).toHaveFocus()
    expect(resultsArea()).toHaveAttribute('aria-busy', 'true')
    expect(rowIds()).toEqual(['suite-4', 'suite-3', 'suite-2', 'suite-1'])
    expect(screen.queryByText('No suites yet')).not.toBeInTheDocument()
    expect(screen.queryByText('No suites match your filters')).not.toBeInTheDocument()

    await act(async () => {
      pending.resolve({ items: rowsFrom(0, 2), nextCursor: null })
    })

    await waitFor(() => expect(rowIds()).toEqual(['s0', 's1']))
    expect(resultsArea()).toHaveAttribute('aria-busy', 'false')
  })

  it('asks once for a typed search, after the last keystroke, and not once per key', async () => {
    const user = userEvent.setup()
    await renderList()
    await screen.findByTestId('suite-row-suite-4')

    await user.type(screen.getByTestId('suite-search'), 'abc')

    await waitFor(() => expect(listSummaries).toHaveBeenCalledTimes(2))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400))
    })
    expect(listSummaries.mock.calls.map(([request]) => request.search)).toEqual([undefined, 'abc'])
  })

  it('shows a failure inside the results area and keeps the filter bar with what was typed and its focus', async () => {
    const user = userEvent.setup()
    await renderList()
    await screen.findByTestId('suite-row-suite-4')
    listSummaries.mockRejectedValueOnce(new Error('down'))
    const input = screen.getByTestId('suite-search')

    await user.type(input, 'abc')

    const alert = await within(resultsArea()).findByRole('alert')
    expect(alert).toHaveTextContent('Could not load suites.')
    expect(screen.getByTestId('suite-search')).toHaveValue('abc')
    expect(input).toHaveFocus()
    expect(alert).not.toHaveFocus()
  })

  it('keeps the keystrokes typed after the failure in the search input', async () => {
    const user = userEvent.setup()
    await renderList()
    await screen.findByTestId('suite-row-suite-4')
    listSummaries.mockRejectedValueOnce(new Error('down'))
    const input = screen.getByTestId('suite-search')
    await user.type(input, 'abc')
    await within(resultsArea()).findByRole('alert')

    await user.keyboard('def')

    expect(input).toHaveValue('abcdef')
    expect(input).toHaveFocus()
  })

  it('starts again from the first page, with no cursor and none of the old rows, when the search changes', async () => {
    const user = userEvent.setup()
    listSummaries.mockImplementation((params) =>
      params.search === undefined
        ? pagedBy(7, 3)(params)
        : later({ items: rowsFrom(100, 102), nextCursor: null }),
    )
    await renderList()
    await user.click(await screen.findByRole('button', { name: 'Load more' }))
    await screen.findByTestId('suite-row-s3')

    await user.type(screen.getByTestId('suite-search'), 'x')

    await waitFor(() => expect(rowIds()).toEqual(['s100', 's101']))
    const last = listSummaries.mock.calls.at(-1)?.[0]
    expect(last).toMatchObject({ search: 'x' })
    expect(last?.cursor).toBeUndefined()
  })

  it('starts again from the first page, with no cursor and none of the old rows, when the order changes', async () => {
    const user = userEvent.setup()
    listSummaries.mockImplementation((params) =>
      params.sort === 'recent'
        ? pagedBy(7, 3)(params)
        : later({ items: rowsFrom(100, 102), nextCursor: null }),
    )
    await renderList()
    await user.click(await screen.findByRole('button', { name: 'Load more' }))
    await screen.findByTestId('suite-row-s3')

    await user.click(screen.getByRole('button', { name: 'Sort suites' }))
    await user.click(await screen.findByText('Name (A→Z)'))

    await waitFor(() => expect(rowIds()).toEqual(['s100', 's101']))
    const last = listSummaries.mock.calls.at(-1)?.[0]
    expect(last).toMatchObject({ sort: 'name' })
    expect(last?.cursor).toBeUndefined()
  })
})
