import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { SuiteSummariesPage } from '@qably/types'
import { suiteKeys } from '@/features/projects/lib/query-keys'
import * as suitesApiStub from '@/test/suites-api-stub'
import { renderList } from './suite-list-harness'
import { rowIds, rowsFrom } from './suite-list-results-pages'
import { deferred } from './suite-summaries-test-data'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

type User = ReturnType<typeof userEvent.setup>

const NO_SUITES: SuiteSummariesPage = { items: [], nextCursor: null }

async function choose(user: User, trigger: string, option: string) {
  await user.click(screen.getByRole('button', { name: trigger }))
  await user.click(await screen.findByRole('option', { name: option }))
}

async function renderLoaded() {
  const rendered = await renderList()
  await screen.findByTestId('suite-row-suite-4')
  await facetLoaded(rendered.client)

  return rendered
}

async function facetLoaded(client: QueryClient) {
  await waitFor(() => {
    expect(client.getQueryState(suiteKeys.tags('proj-1'))?.status).toBe('success')
  })
}

describe('SuiteList filters', () => {
  let listSummaries: MockInstance<typeof suitesApiStub.listSuiteSummaries>

  beforeEach(() => {
    suitesApiStub.__resetSuitesStub()
    listSummaries = vi.spyOn(suitesApiStub, 'listSuiteSummaries')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('a status, a tag or an order', () => {
    it.each([
      ['status', 'Status filter', 'Fail', { status: 'fail' }],
      ['tag', 'Tag filter', 'smoke', { tag: 'smoke' }],
      ['order', 'Sort suites', 'Name (A→Z)', { sort: 'name' }],
    ])('is asked for at once, without the delay of the search, when the %s changes', async (_label, trigger, option, expected) => {
      const user = userEvent.setup()
      await renderLoaded()

      await choose(user, trigger, option)

      await waitFor(() => expect(listSummaries).toHaveBeenCalledTimes(2), { timeout: 250 })
      const request = listSummaries.mock.calls[1][0]
      expect(request).toMatchObject({ projectId: 'proj-1', ...expected })
      expect(Object.values(request)).not.toContain('all')
      expect(request.cursor).toBeUndefined()
    })

    it('leaves the status and the tag out of the request again when they go back to all', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      await choose(user, 'Status filter', 'Fail')
      await choose(user, 'Tag filter', 'smoke')
      await waitFor(() => {
        expect(listSummaries.mock.calls.at(-1)?.[0]).toMatchObject({ status: 'fail', tag: 'smoke' })
      })

      await choose(user, 'Status filter', 'All statuses')
      await choose(user, 'Tag filter', 'All tags')

      await waitFor(() => {
        const last = listSummaries.mock.calls.at(-1)?.[0]

        expect(last?.status).toBeUndefined()
        expect(last?.tag).toBeUndefined()
      })
      expect(Object.values(listSummaries.mock.calls.at(-1)?.[0] ?? {})).not.toContain('all')
    })
  })

  describe('a search answered out of order', () => {
    it('shows the results of the latest search even when an older one answers after it', async () => {
      const user = userEvent.setup()
      const older = deferred<SuiteSummariesPage>()
      const latest = deferred<SuiteSummariesPage>()
      await renderLoaded()
      listSummaries
        .mockImplementationOnce(() => older.promise)
        .mockImplementationOnce(() => latest.promise)
      const input = screen.getByTestId('suite-search')

      await user.type(input, 'ab')
      await waitFor(() => expect(listSummaries).toHaveBeenCalledTimes(2))
      await user.type(input, 'c')
      await waitFor(() => expect(listSummaries).toHaveBeenCalledTimes(3))
      expect(listSummaries.mock.calls[1][0]).toMatchObject({ search: 'ab' })
      expect(listSummaries.mock.calls[2][0]).toMatchObject({ search: 'abc' })

      await act(async () => {
        latest.resolve({ items: rowsFrom(200, 201), nextCursor: null })
      })
      await waitFor(() => expect(rowIds()).toEqual(['s200']))
      await act(async () => {
        older.resolve({ items: rowsFrom(100, 102), nextCursor: null })
      })

      expect(rowIds()).toEqual(['s200'])
    })
  })

  describe('clearing the filters', () => {
    it('empties the search, the status and the tag, keeps the order and gives the search the focus', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      await choose(user, 'Sort suites', 'Name (A→Z)')
      await choose(user, 'Status filter', 'Fail')
      await choose(user, 'Tag filter', 'smoke')
      listSummaries.mockImplementation(() => Promise.resolve(NO_SUITES))
      const input = screen.getByTestId('suite-search')
      await user.type(input, 'xyz')

      await user.click(await screen.findByRole('button', { name: 'Clear filters' }))

      expect(input).toHaveValue('')
      expect(input).toHaveFocus()
      expect(screen.getByRole('button', { name: 'Status filter' })).toHaveTextContent('All statuses')
      expect(screen.getByRole('button', { name: 'Tag filter' })).toHaveTextContent('All tags')
      expect(screen.getByRole('button', { name: 'Sort suites' })).toHaveTextContent('Name (A→Z)')
    })

    it('asks for the unfiltered results at once, in the order that was chosen, and not 300 ms later', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      await choose(user, 'Sort suites', 'Name (A→Z)')
      await waitFor(() => expect(listSummaries).toHaveBeenCalledTimes(2))
      listSummaries.mockResolvedValueOnce(NO_SUITES)
      await user.type(screen.getByTestId('suite-search'), 'xyz')
      const clear = await screen.findByRole('button', { name: 'Clear filters' })
      const before = listSummaries.mock.calls.length

      await user.click(clear)

      await waitFor(() => expect(listSummaries.mock.calls.length).toBeGreaterThan(before), {
        timeout: 250,
      })
      const request = listSummaries.mock.calls.at(-1)?.[0]
      expect(request).toMatchObject({ sort: 'name' })
      expect(request?.search).toBeUndefined()
      expect(request?.status).toBeUndefined()
      expect(request?.tag).toBeUndefined()
    })

    it('does not let the sheet of the filters clear the search, only the status and the tag', async () => {
      const user = userEvent.setup()
      await renderLoaded()
      const input = screen.getByTestId('suite-search')
      await user.type(input, 'au')
      await choose(user, 'Status filter', 'Fail')
      await waitFor(() => {
        expect(listSummaries.mock.calls.at(-1)?.[0]).toMatchObject({ search: 'au', status: 'fail' })
      })

      await user.click(screen.getByTestId('suite-filters-trigger'))
      const sheet = await screen.findByRole('dialog')
      await user.click(within(sheet).getByRole('button', { name: /clear filters/i }))
      await user.click(within(sheet).getByRole('button', { name: 'Apply' }))

      await waitFor(() => {
        expect(listSummaries.mock.calls.at(-1)?.[0].status).toBeUndefined()
      })
      expect(listSummaries.mock.calls.at(-1)?.[0]).toMatchObject({ search: 'au' })
      expect(input).toHaveValue('au')
      expect(screen.getByRole('button', { name: 'Status filter' })).toHaveTextContent('All statuses')
    })
  })
})
