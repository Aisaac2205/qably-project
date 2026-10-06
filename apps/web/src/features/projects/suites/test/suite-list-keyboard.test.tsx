import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import * as suitesApiStub from '@/test/suites-api-stub'
import { renderList } from './suite-list-harness'
import { pagedBy } from './suite-list-results-pages'

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

function stopOf(element: Element | null): string {
  if (element === null || element === document.body) return 'outside'
  if (element.getAttribute('data-testid') === 'suite-search') return 'search'
  if (element.getAttribute('aria-haspopup') === 'listbox') return 'filter'
  if (element.getAttribute('data-testid') === 'suite-filters-trigger') return 'filters-sheet'
  if (element.tagName === 'A' && element.getAttribute('href')?.endsWith('/suites/new')) {
    return 'new-suite'
  }
  if (element.closest('li') !== null) return 'row'
  if (element.textContent === 'Load more') return 'load-more'

  return `unknown ${element.tagName}`
}

function withoutRepeats(stops: string[]): string[] {
  return stops.filter((stop, index) => stop !== stops[index - 1])
}

describe('SuiteList keyboard', () => {
  let listSummaries: MockInstance<typeof suitesApiStub.listSuiteSummaries>

  beforeEach(() => {
    suitesApiStub.__resetSuitesStub()
    listSummaries = vi.spyOn(suitesApiStub, 'listSuiteSummaries')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('follows the DOM order of the controls, whatever the breakpoint hides: search, filters, New suite, rows, Load more', async () => {
    const user = userEvent.setup()
    listSummaries.mockImplementation(pagedBy(7, 3))
    await renderList()
    await screen.findByRole('button', { name: 'Load more' })

    const stops: string[] = []
    for (let press = 0; press < 14; press += 1) {
      await user.tab()
      stops.push(stopOf(document.activeElement))
    }

    expect(withoutRepeats(stops).slice(0, 6)).toEqual([
      'search',
      'filter',
      'new-suite',
      'filters-sheet',
      'row',
      'load-more',
    ])
  })

  it('never keeps the focus in one place, so there is no trap from the first control to the last', async () => {
    const user = userEvent.setup()
    listSummaries.mockImplementation(pagedBy(7, 3))
    await renderList()
    await screen.findByRole('button', { name: 'Load more' })

    const visited = new Set<Element>()
    for (let press = 0; press < 14; press += 1) {
      await user.tab()
      if (document.activeElement !== null) visited.add(document.activeElement)
    }

    expect(visited.size).toBeGreaterThanOrEqual(13)
  })

  it('names the list after the suites and keeps the search landmark under its own name', async () => {
    await renderList()

    expect(await screen.findByRole('list', { name: 'Suites' })).toBeInTheDocument()
    expect(screen.getByRole('search', { name: 'Filter suites' })).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Filter suites' })).not.toBeInTheDocument()
  })
})
