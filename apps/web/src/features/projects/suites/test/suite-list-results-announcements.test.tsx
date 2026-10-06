import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { SuiteSummariesPage } from '@qably/types'
import { useI18nStore } from '@/lib/i18n/store'
import * as suitesApiStub from '@/test/suites-api-stub'
import { renderResults } from './suite-list-results-harness'
import { pagedBy, rowsFrom } from './suite-list-results-pages'
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
    useI18nStore.setState({ locale: 'en' })
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
    expect(announcement()).toHaveTextContent('3 more suites loaded')

    await user.click(await screen.findByRole('button', { name: 'Load more' }))
    await screen.findByTestId('suite-row-s6')
    expect(announcement()).toHaveTextContent('1 more suite loaded')
  })

  it('speaks Spanish with the right plural', async () => {
    const user = userEvent.setup()
    useI18nStore.setState({ locale: 'es' })
    listSummaries.mockImplementation(pagedBy(7, 3))
    await renderResults()

    await user.click(await screen.findByRole('button', { name: 'Cargar más' }))
    await screen.findByTestId('suite-row-s3')
    expect(announcement()).toHaveTextContent('Se cargaron 3 suites más')

    await user.click(await screen.findByRole('button', { name: 'Cargar más' }))
    await screen.findByTestId('suite-row-s6')
    expect(announcement()).toHaveTextContent('Se cargó 1 suite más')
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
})
