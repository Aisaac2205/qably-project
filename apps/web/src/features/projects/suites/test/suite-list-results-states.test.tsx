import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { SuiteSummariesPage } from '@qably/types'
import { suiteKeys } from '@/features/projects/lib/query-keys'
import * as suitesApiStub from '@/test/suites-api-stub'
import { EMPTY_PAGE, NO_SUITES_PROJECT, renderResults } from './suite-list-results-harness'
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

describe('SuiteListResults states', () => {
  let listSummaries: MockInstance<typeof suitesApiStub.listSuiteSummaries>

  beforeEach(() => {
    suitesApiStub.__resetSuitesStub()
    listSummaries = vi.spyOn(suitesApiStub, 'listSuiteSummaries')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('while new results are on their way', () => {
    it('keeps the previous rows and marks the area busy until the answer lands', async () => {
      const pending = deferred<SuiteSummariesPage>()
      const { rerenderWith } = await renderResults()
      await screen.findByRole('list', { name: 'Suites' })
      expect(screen.getByTestId('suite-list-results')).toHaveAttribute('aria-busy', 'false')
      listSummaries.mockReturnValueOnce(pending.promise)

      await rerenderWith({ filters: { ...NO_FILTERS, search: 'abc' } })

      expect(screen.getByTestId('suite-list-results')).toHaveAttribute('aria-busy', 'true')
      expect(screen.getAllByRole('listitem')).toHaveLength(4)
      expect(screen.queryByText('No suites match your filters')).not.toBeInTheDocument()
      expect(screen.queryByText('No suites yet')).not.toBeInTheDocument()

      await act(async () => {
        pending.resolve(EMPTY_PAGE)
      })

      expect(await screen.findByText('No suites match your filters')).toBeInTheDocument()
      expect(screen.getByTestId('suite-list-results')).toHaveAttribute('aria-busy', 'false')
    })

    it('shows the loading state, not an empty state, when there was nothing to keep', async () => {
      const pending = deferred<SuiteSummariesPage>()
      const { rerenderWith } = await renderResults({ projectId: NO_SUITES_PROJECT })
      expect(await screen.findByText('No suites yet')).toBeInTheDocument()
      listSummaries.mockReturnValueOnce(pending.promise)

      await rerenderWith({ filters: { ...NO_FILTERS, status: 'fail' } })

      expect(screen.getAllByRole('status').map((region) => region.textContent)).toContain('Loading…')
      expect(screen.queryByText('No suites yet')).not.toBeInTheDocument()
      expect(screen.queryByText('No suites match your filters')).not.toBeInTheDocument()

      await act(async () => {
        pending.resolve(EMPTY_PAGE)
      })

      expect(await screen.findByText('No suites match your filters')).toBeInTheDocument()
    })
  })

  describe('when the first page fails', () => {
    it('shows the error with the focus on it and retries on demand', async () => {
      const user = userEvent.setup()
      listSummaries.mockRejectedValueOnce(new Error('down'))

      await renderResults()

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Could not load suites.')
      expect(alert).toHaveFocus()
      expect(screen.queryByRole('list')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Retry' }))

      expect(await screen.findByRole('list', { name: 'Suites' })).toBeInTheDocument()
      expect(listSummaries).toHaveBeenCalledTimes(2)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('asks for the same first page again, with no cursor', async () => {
      const user = userEvent.setup()
      listSummaries.mockRejectedValueOnce(new Error('down'))
      await renderResults({ filters: { ...NO_FILTERS, sort: 'cases' } })

      await user.click(await screen.findByRole('button', { name: 'Retry' }))

      await waitFor(() => expect(listSummaries).toHaveBeenCalledTimes(2))
      expect(listSummaries.mock.calls[1][0]).toMatchObject({ sort: 'cases', cursor: undefined })
    })

    it('takes the focus from a link outside the list, as after a click in the sidebar', async () => {
      const sidebarLink = document.createElement('a')
      sidebarLink.href = '/projects'
      document.body.append(sidebarLink)

      try {
        sidebarLink.focus()
        expect(sidebarLink).toHaveFocus()
        listSummaries.mockRejectedValueOnce(new Error('down'))

        await renderResults()

        expect(await screen.findByRole('alert')).toHaveFocus()
      } finally {
        sidebarLink.remove()
      }
    })

    it('leaves the focus on a control of the list the user reached first', async () => {
      const pending = deferred<SuiteSummariesPage>()
      listSummaries.mockReturnValueOnce(pending.promise)
      await renderResults({}, createQueryClient(), <input aria-label="Toolbar stand-in" />)
      const control = screen.getByLabelText('Toolbar stand-in')
      act(() => control.focus())

      await act(async () => {
        pending.reject(new Error('down'))
      })

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Could not load suites.')
      expect(control).toHaveFocus()
      expect(alert).not.toHaveFocus()
    })
  })

  describe('when the answer to a change of filters fails', () => {
    it('leaves the focus on the control of the list the user is in', async () => {
      const { rerenderWith } = await renderResults(
        {},
        createQueryClient(),
        <input aria-label="Toolbar stand-in" />,
      )
      await screen.findByRole('list', { name: 'Suites' })
      const control = screen.getByLabelText('Toolbar stand-in')
      act(() => control.focus())
      listSummaries.mockRejectedValueOnce(new Error('down'))

      await rerenderWith({ filters: { ...NO_FILTERS, search: 'abc' } })

      const alert = await screen.findByRole('alert')
      expect(alert).toHaveTextContent('Could not load suites.')
      expect(control).toHaveFocus()
      expect(alert).not.toHaveFocus()
    })

    it('takes the focus from a control outside the list', async () => {
      const outside = document.createElement('input')
      document.body.append(outside)

      try {
        const { rerenderWith } = await renderResults()
        await screen.findByRole('list', { name: 'Suites' })
        act(() => outside.focus())
        expect(outside).toHaveFocus()
        listSummaries.mockRejectedValueOnce(new Error('down'))

        await rerenderWith({ filters: { ...NO_FILTERS, search: 'abc' } })

        const alert = await screen.findByRole('alert')
        expect(alert).toHaveTextContent('Could not load suites.')
        expect(alert).toHaveFocus()
      } finally {
        outside.remove()
      }
    })

    it('takes the focus when nothing else holds it', async () => {
      const { rerenderWith } = await renderResults()
      await screen.findByRole('list', { name: 'Suites' })
      expect(document.body).toHaveFocus()
      listSummaries.mockRejectedValueOnce(new Error('down'))

      await rerenderWith({ filters: { ...NO_FILTERS, search: 'abc' } })

      expect(await screen.findByRole('alert')).toHaveFocus()
    })

    it('takes the focus from the row link the error replaces', async () => {
      const { rerenderWith } = await renderResults()
      const list = await screen.findByRole('list', { name: 'Suites' })
      const link = within(list).getAllByRole('link')[0]
      act(() => link.focus())
      expect(link).toHaveFocus()
      listSummaries.mockRejectedValueOnce(new Error('down'))

      await rerenderWith({ filters: { ...NO_FILTERS, search: 'abc' } })

      const alert = await screen.findByRole('alert')
      expect(link).not.toBeInTheDocument()
      expect(alert).toHaveFocus()
    })
  })

  describe('when a refresh in the background fails', () => {
    it('keeps the rows and shows no blocking error', async () => {
      const { client } = await renderResults()
      await screen.findByRole('list', { name: 'Suites' })
      listSummaries.mockRejectedValueOnce(new Error('down'))

      await act(async () => {
        await client.invalidateQueries({ queryKey: suiteKeys.summaries('proj-1') })
      })

      await waitFor(() => {
        const [query] = client.getQueryCache().findAll({ queryKey: suiteKeys.summaries('proj-1') })

        expect(query?.state.status).toBe('error')
      })
      expect(screen.getAllByRole('listitem')).toHaveLength(4)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })
})
