import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { SuiteSummariesPage } from '@qably/types'
import { useI18nStore } from '@/lib/i18n/store'
import { suiteKeys } from '@/features/projects/lib/query-keys'
import type { SuiteSummariesQuery } from '@/features/projects/suites/lib/suite-summaries-query'
import * as suitesApiStub from '@/test/suites-api-stub'
import { renderResults } from './suite-list-results-harness'
import { pagedBy, rowsFrom } from './suite-list-results-pages'
import { NO_FILTERS, createQueryClient, deferred } from './suite-summaries-test-data'

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

function announcement(): HTMLElement {
  return screen.getByTestId('suite-list-announcement')
}

describe('SuiteListResults announcements', () => {
  let listSummaries: MockInstance<typeof suitesApiStub.listSuiteSummaries>

  beforeEach(() => {
    suitesApiStub.__resetSuitesStub()
    listSummaries = vi.spyOn(suitesApiStub, 'listSuiteSummaries')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    act(() => {
      useI18nStore.setState({ locale: 'en' })
    })
  })

  it('is a polite status region that is mounted from the first render, even while loading', async () => {
    listSummaries.mockReturnValue(new Promise(() => undefined))

    await renderResults()

    const region = announcement()
    expect(region).toHaveAttribute('role', 'status')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveAttribute('aria-atomic', 'true')
    expect(region).toBeEmptyDOMElement()
  })

  it('stays mounted when the first page fails', async () => {
    listSummaries.mockRejectedValueOnce(new Error('down'))

    await renderResults()

    await screen.findByRole('alert')
    expect(announcement()).toBeInTheDocument()
    expect(announcement()).toBeEmptyDOMElement()
  })

  it('says nothing once the first page lands', async () => {
    listSummaries.mockImplementation(pagedBy(7, 3))

    await renderResults()

    await screen.findByTestId('suite-row-s0')
    expect(announcement()).toBeEmptyDOMElement()
  })

  it('says how many suites the page brought, with the right plural', async () => {
    const user = userEvent.setup()
    listSummaries.mockImplementation(pagedBy(7, 3))
    await renderResults()

    await user.click(await screen.findByRole('button', { name: 'Load more' }))
    await screen.findByTestId('suite-row-s3')
    await within(announcement()).findByText('3 more suites loaded')

    await user.click(await screen.findByRole('button', { name: 'Load more' }))
    await screen.findByTestId('suite-row-s6')
    await within(announcement()).findByText('1 more suite loaded')
  })

  it('says how many suites the page brought even when it answered at once', async () => {
    const user = userEvent.setup()
    listSummaries
      .mockResolvedValueOnce({ items: rowsFrom(0, 3), nextCursor: '3' })
      .mockResolvedValueOnce({ items: rowsFrom(3, 4), nextCursor: null })
    await renderResults()

    await user.click(await screen.findByRole('button', { name: 'Load more' }))

    await within(announcement()).findByText('1 more suite loaded')
  })

  it('says nothing when the page only repeated rows that were already shown', async () => {
    const user = userEvent.setup()
    listSummaries
      .mockResolvedValueOnce({ items: rowsFrom(0, 3), nextCursor: '3' })
      .mockResolvedValueOnce({ items: rowsFrom(1, 3), nextCursor: null })
    await renderResults()

    await user.click(await screen.findByRole('button', { name: 'Load more' }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
    })
    expect(announcement()).toBeEmptyDOMElement()
  })

  it('speaks Spanish with the right plural', async () => {
    const user = userEvent.setup()
    act(() => {
      useI18nStore.setState({ locale: 'es' })
    })
    listSummaries.mockImplementation(pagedBy(7, 3))
    await renderResults()

    await user.click(await screen.findByRole('button', { name: 'Cargar más' }))
    await screen.findByTestId('suite-row-s3')
    await within(announcement()).findByText('Se cargaron 3 suites más')

    await user.click(await screen.findByRole('button', { name: 'Cargar más' }))
    await screen.findByTestId('suite-row-s6')
    await within(announcement()).findByText('Se cargó 1 suite más')
  })

  it('says nothing when the next page fails', async () => {
    const user = userEvent.setup()
    listSummaries
      .mockImplementationOnce(pagedBy(7, 3))
      .mockRejectedValueOnce(new Error('down'))
    await renderResults()

    await user.click(await screen.findByRole('button', { name: 'Load more' }))

    await screen.findByRole('alert')
    expect(announcement()).toBeEmptyDOMElement()
  })

  it('says how many suites a settled change of filters shows, and nothing while it is pending', async () => {
    const pending = deferred<SuiteSummariesPage>()
    listSummaries.mockImplementation(pagedBy(7, 3))
    const { rerenderWith } = await renderResults()
    await screen.findByTestId('suite-row-s0')
    listSummaries.mockImplementationOnce(() => pending.promise)

    await rerenderWith({ filters: { ...NO_FILTERS, status: 'fail' } })

    expect(announcement()).toBeEmptyDOMElement()

    await act(async () => {
      pending.resolve({ items: rowsFrom(0, 2), nextCursor: null })
    })

    await within(announcement()).findByText('2 suites shown')
  })

  it('empties the region before it says the same count again for other results', async () => {
    const client = createQueryClient()
    client.setDefaultOptions({
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity, refetchOnMount: false },
    })
    const seed = (query: SuiteSummariesQuery, count: number) =>
      client.setQueryData(suiteKeys.summaryPage('proj-1', query), {
        pages: [{ items: rowsFrom(0, count), nextCursor: null }],
        pageParams: [undefined],
      })
    seed({ sort: 'recent' }, 3)
    seed({ sort: 'recent', search: 'a' }, 2)
    seed({ sort: 'recent', search: 'b' }, 2)
    const { rerenderWith } = await renderResults({}, client)
    await rerenderWith({ filters: { ...NO_FILTERS, search: 'a' } })
    await within(announcement()).findByText('2 suites shown')
    const seen: string[] = []
    const observer = new MutationObserver(() => seen.push(announcement().textContent ?? ''))
    observer.observe(announcement(), { childList: true, characterData: true, subtree: true })

    await rerenderWith({ filters: { ...NO_FILTERS, search: 'b' } })

    await waitFor(() => expect(seen).toEqual(['', '2 suites shown']))
    observer.disconnect()
  })
})
