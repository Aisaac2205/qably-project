import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import * as suitesApiStub from '@/test/suites-api-stub'
import { NO_SUITES_PROJECT, renderResults } from './suite-list-results-harness'
import { NO_FILTERS } from './suite-summaries-test-data'

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

describe('SuiteListResults', () => {
  let listSummaries: MockInstance<typeof suitesApiStub.listSuiteSummaries>

  beforeEach(() => {
    suitesApiStub.__resetSuitesStub()
    listSummaries = vi.spyOn(suitesApiStub, 'listSuiteSummaries')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('the first page', () => {
    it('shows a loading state, and no empty state, while the page is on its way', async () => {
      listSummaries.mockReturnValue(new Promise(() => undefined))

      await renderResults()

      expect(screen.getAllByRole('status').map((region) => region.textContent)).toContain('Loading…')
      expect(screen.queryByText('No suites yet')).not.toBeInTheDocument()
      expect(screen.queryByText('No suites match your filters')).not.toBeInTheDocument()
      expect(screen.queryByRole('list')).not.toBeInTheDocument()
    })

    it('lists the suites of the page, most recent first, in a list that has a name', async () => {
      await renderResults()

      const list = await screen.findByRole('list', { name: 'Suites' })
      const rowIds = within(list)
        .getAllByTestId(/^suite-row-/)
        .map((row) => row.getAttribute('data-testid'))

      expect(rowIds).toEqual([
        'suite-row-suite-4',
        'suite-row-suite-3',
        'suite-row-suite-2',
        'suite-row-suite-1',
      ])
      expect(within(list).getByText('Payments')).toBeInTheDocument()
      expect(within(list).getByText('Authentication')).toBeInTheDocument()
    })

    it('links every row to its own suite', async () => {
      await renderResults()

      await screen.findByRole('list', { name: 'Suites' })

      for (const id of ['suite-1', 'suite-2', 'suite-3', 'suite-4']) {
        expect(screen.getByTestId(`suite-row-${id}`).closest('a')).toHaveAttribute(
          'href',
          `/projects/proj-1/suites/${id}`,
        )
      }
    })

    it('links the rows of another project to that project', async () => {
      await suitesApiStub.createSuite({ projectId: 'proj-2', name: 'Elsewhere' })

      await renderResults({ projectId: 'proj-2' })

      const link = (await screen.findByText('Elsewhere')).closest('a')
      expect(link).toHaveAttribute('href', expect.stringMatching(/^\/projects\/proj-2\/suites\/suite-/))
    })

    it('asks the server for the filters it was given, and for no cursor', async () => {
      await renderResults({ filters: { ...NO_FILTERS, sort: 'name', status: 'needs-attention' } })

      await screen.findByRole('list', { name: 'Suites' })

      expect(listSummaries).toHaveBeenCalledTimes(1)
      expect(listSummaries.mock.calls[0][0]).toMatchObject({
        projectId: 'proj-1',
        sort: 'name',
        status: 'needs-attention',
        cursor: undefined,
      })
      expect(screen.getAllByRole('listitem')).toHaveLength(1)
      expect(screen.getByText('Checkout')).toBeInTheDocument()
    })
  })

  describe('a project without suites', () => {
    it('invites to create the first suite', async () => {
      await renderResults({ projectId: NO_SUITES_PROJECT })

      expect(await screen.findByText('No suites yet')).toBeInTheDocument()
      expect(
        screen.getByText('Create your first suite to start organizing test cases.'),
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'New suite' })).toHaveAttribute(
        'href',
        `/projects/${NO_SUITES_PROJECT}/suites/new`,
      )
      expect(screen.queryByText('No suites match your filters')).not.toBeInTheDocument()
    })

    it.each([
      ['a search of only whitespace', { search: '   ' }],
      ['the all sentinels', { status: 'all' as const, tag: 'all' as const }],
      ['an empty tag', { tag: '' }],
    ])(
      'is still a project without suites under %s, which the server never receives',
      async (_label, filters) => {
        await renderResults({
          projectId: NO_SUITES_PROJECT,
          filters: { ...NO_FILTERS, ...filters },
        })

        expect(await screen.findByText('No suites yet')).toBeInTheDocument()
        expect(screen.queryByText('No suites match your filters')).not.toBeInTheDocument()
      },
    )
  })

  describe('filters that match nothing', () => {
    it('says nothing matches and offers to clear the filters', async () => {
      const user = userEvent.setup()
      const { onClearFilters } = await renderResults({
        filters: { ...NO_FILTERS, search: 'no-such-suite' },
      })

      expect(await screen.findByText('No suites match your filters')).toBeInTheDocument()
      expect(screen.queryByText('No suites yet')).not.toBeInTheDocument()
      expect(screen.queryByRole('list')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Clear filters' }))

      expect(onClearFilters).toHaveBeenCalledTimes(1)
    })

    it.each([
      ['a search', { search: 'login' }],
      ['a status', { status: 'fail' as const }],
      ['a tag', { tag: 'smoke' }],
    ])('reads %s sent to the server as a filter, not as a project without suites', async (_label, filters) => {
      await renderResults({ projectId: NO_SUITES_PROJECT, filters: { ...NO_FILTERS, ...filters } })

      expect(await screen.findByText('No suites match your filters')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
      expect(screen.queryByText('No suites yet')).not.toBeInTheDocument()
    })
  })

})
