import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { expectFocusRing } from '@/features/runs/test/focus-ring'
import * as suitesApiStub from '@/test/suites-api-stub'
import { renderList } from './suite-list-harness'
import { pagedBy, rowIds } from './suite-list-results-pages'

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

describe('SuiteList', () => {
  let listSummaries: MockInstance<typeof suitesApiStub.listSuiteSummaries>
  let listTags: MockInstance<typeof suitesApiStub.listSuiteTags>
  let listSuites: MockInstance<typeof suitesApiStub.listSuites>

  beforeEach(() => {
    suitesApiStub.__resetSuitesStub()
    listSummaries = vi.spyOn(suitesApiStub, 'listSuiteSummaries')
    listTags = vi.spyOn(suitesApiStub, 'listSuiteTags')
    listSuites = vi.spyOn(suitesApiStub, 'listSuites')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('when it opens', () => {
    it('asks for one page of summaries and for the tags, and for nothing else', async () => {
      await renderList()

      await screen.findByTestId('suite-row-suite-4')

      expect(listSummaries).toHaveBeenCalledTimes(1)
      const [request] = listSummaries.mock.calls[0]
      expect(request).toMatchObject({ projectId: 'proj-1', sort: 'recent' })
      expect(request.search).toBeUndefined()
      expect(request.status).toBeUndefined()
      expect(request.tag).toBeUndefined()
      expect(request.cursor).toBeUndefined()
      expect(request.limit).toBeGreaterThan(0)
      expect(request.limit).toBeLessThanOrEqual(100)
      expect(listTags).toHaveBeenCalledTimes(1)
      expect(listTags.mock.calls[0][0]).toBe('proj-1')
      expect(listSuites).not.toHaveBeenCalled()
    })

    it('shows the filter bar and the suites, most recent first, each linking to its page', async () => {
      await renderList()

      await screen.findByTestId('suite-row-suite-4')

      expect(screen.getByTestId('suite-search')).toBeInTheDocument()
      expect(rowIds()).toEqual(['suite-4', 'suite-3', 'suite-2', 'suite-1'])
      expect(screen.getByText('Authentication').closest('a')).toHaveAttribute(
        'href',
        '/projects/proj-1/suites/suite-1',
      )
    })

    it('offers a New suite link to the create-suite page, not a modal trigger', async () => {
      await renderList()

      await screen.findByTestId('suite-row-suite-4')

      expect(screen.getByRole('link', { name: /new suite/i })).toHaveAttribute(
        'href',
        '/projects/proj-1/suites/new',
      )
    })

    it('draws the focus ring of the repo, inset, on every row link', async () => {
      await renderList()
      await screen.findByTestId('suite-row-suite-4')

      const links = screen.getAllByRole('listitem').map((row) => row.querySelector('a'))

      expect(links).toHaveLength(4)
      for (const link of links) {
        expect(link).not.toBeNull()
        expectFocusRing(link as HTMLElement, { inset: true })
      }
    })
  })

  describe('with more suites than one page', () => {
    it('shows one page of rows and offers to load more', async () => {
      listSummaries.mockImplementation(pagedBy(120, 50))

      await renderList()

      await screen.findByTestId('suite-row-s49')
      expect(rowIds()).toHaveLength(50)
      expect(screen.queryByTestId('suite-row-s50')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument()
    })
  })

  describe('when the first load fails', () => {
    it('puts the focus on the error, beside the filter bar, and brings the suites back on retry', async () => {
      const user = userEvent.setup()
      listSummaries.mockRejectedValueOnce(new Error('down'))

      await renderList()

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Could not load suites.')
      expect(alert).toHaveFocus()
      expect(screen.getByTestId('suite-search')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Retry' }))

      await screen.findByTestId('suite-row-suite-4')
      expect(rowIds()).toEqual(['suite-4', 'suite-3', 'suite-2', 'suite-1'])
    })
  })

  describe('when there is nothing to list', () => {
    it('says there are no suites yet, with the hint and a link to create the first one', async () => {
      await renderList('proj-empty')

      expect(await screen.findByText('No suites yet')).toBeInTheDocument()
      expect(
        screen.getByText('Create your first suite to start organizing test cases.'),
      ).toBeInTheDocument()
      const links = screen.getAllByRole('link', { name: /new suite/i })
      expect(links).toHaveLength(2)
      for (const link of links) {
        expect(link).toHaveAttribute('href', '/projects/proj-empty/suites/new')
      }
      expect(screen.getByTestId('suite-search')).toBeInTheDocument()
    })

    it('says no suite matches, with a way to clear the filters, when the search finds nothing', async () => {
      const user = userEvent.setup()
      await renderList()
      await screen.findByTestId('suite-row-suite-4')

      await user.type(screen.getByTestId('suite-search'), 'xyz-no-match')

      expect(await screen.findByText('No suites match your filters')).toBeInTheDocument()
      expectFocusRing(screen.getByRole('button', { name: 'Clear filters' }))
      expect(screen.queryByText('No suites yet')).not.toBeInTheDocument()
      await waitFor(() => expect(listSummaries).toHaveBeenCalledTimes(2))
      expect(listSummaries.mock.calls[1][0]).toMatchObject({ search: 'xyz-no-match' })
    })
  })
})
