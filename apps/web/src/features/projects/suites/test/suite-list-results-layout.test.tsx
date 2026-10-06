import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { expectFocusRing } from '@/features/runs/test/focus-ring'
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

describe('SuiteListResults layout', () => {
  let listSummaries: MockInstance<typeof suitesApiStub.listSuiteSummaries>

  beforeEach(() => {
    suitesApiStub.__resetSuitesStub()
    listSummaries = vi.spyOn(suitesApiStub, 'listSuiteSummaries')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('long content', () => {
    it('keeps a name of 120 characters and 20 tags inside the area', async () => {
      const name = 'n'.repeat(120)
      const tags = Array.from({ length: 20 }, (_, index) => `tag-${index}`)
      const created = await suitesApiStub.createSuite({ projectId: 'proj-1', name, tags })

      await renderResults()

      const row = await screen.findByTestId(`suite-row-${created.id}`)
      const nameElement = within(row).getByText(name)
      const nameColumn = nameElement.closest(`[data-testid="${row.dataset.testid}"] > *`)
      const tagNodes = within(row).getAllByText(/^tag-\d+$/)
      expect(nameElement).toHaveClass('truncate')
      expect(nameColumn).not.toBeNull()
      expect(nameColumn).not.toBe(nameElement)
      expect(nameColumn).toHaveClass('min-w-0')
      expect(tagNodes).toHaveLength(20)
      expect(tagNodes[0].parentElement).toHaveClass('flex-wrap')
      expect(screen.getByTestId('suite-list-results')).toHaveClass('min-w-0')
    })
  })

  describe('touch targets and focus rings', () => {
    it('gives the clear filters button a 44 px target below md and the focus ring of the repo', async () => {
      await renderResults({ filters: { ...NO_FILTERS, search: 'no-such-suite' } })

      const button = await screen.findByRole('button', { name: 'Clear filters' })

      expect(button).toHaveClass('h-11')
      expectFocusRing(button)
    })

    it('gives the retry button a 44 px target below md and the focus ring of the repo', async () => {
      listSummaries.mockRejectedValueOnce(new Error('down'))
      await renderResults()

      const button = await screen.findByRole('button', { name: 'Retry' })

      expect(button).toHaveClass('h-11')
      expectFocusRing(button)
    })

    it('gives the new suite link a 44 px target below md and the focus ring of the repo', async () => {
      await renderResults({ projectId: NO_SUITES_PROJECT })

      const link = await screen.findByRole('link', { name: 'New suite' })

      expect(link).toHaveClass('h-11')
      expectFocusRing(link)
    })

    it('paints the hover surface on the link that draws the ring, so nothing inside the row covers it', async () => {
      await renderResults()
      await screen.findByRole('list', { name: 'Filter suites' })

      const items = screen.getAllByRole('listitem')

      expect(items).toHaveLength(4)
      for (const item of items) {
        const link = item.querySelector('a')

        expect(link).not.toBeNull()
        expect(item.querySelectorAll('[class~="hover:bg-surface-hover/60"]')).toHaveLength(1)
        expect(link).toHaveClass('hover:bg-surface-hover/60')
        expectFocusRing(link as HTMLElement, { inset: true })
      }
    })

    it('draws the focus ring of the repo, inset, on the link of every row', async () => {
      await renderResults()
      await screen.findByRole('list', { name: 'Filter suites' })

      const links = screen.getAllByRole('listitem').map((row) => row.querySelector('a'))

      expect(links).toHaveLength(4)
      for (const link of links) {
        expect(link).not.toBeNull()
        expectFocusRing(link as HTMLElement, { inset: true })
      }
    })
  })
})
