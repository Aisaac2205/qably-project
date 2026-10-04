import { act, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CiRunSummaryRecord } from '@qably/types'
import { CiRunList } from '@/features/runs/components/ci-run-list'
import { ciRunKeys } from '@/features/runs/lib/query-keys'
import { listCiRuns } from '@/features/runs/api/ci-runs.api'
import { useI18nStore } from '@/lib/i18n/store'
import { NOW, PROJECT, ciRunSummary } from './ci-run-fixtures'

vi.mock('@/features/runs/api/ci-runs.api', () => ({
  listCiRuns: vi.fn(),
  getCiRun: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const list = vi.mocked(listCiRuns)

function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnMount: false } },
  })
}

function renderList(client: QueryClient = createClient()) {
  return render(
    <QueryClientProvider client={client}>
      <CiRunList projectId={PROJECT} />
    </QueryClientProvider>,
  )
}

function renderSeeded(items: CiRunSummaryRecord[]) {
  const client = createClient()
  client.setQueryData(ciRunKeys.page(PROJECT), { pages: [{ items }], pageParams: [undefined] })
  return renderList(client)
}

function rowLinks(): HTMLElement[] {
  return within(screen.getByRole('list', { name: 'CI runs' })).getAllByRole('link')
}

describe('CiRunList rows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ now: NOW, toFake: ['Date', 'setInterval', 'clearInterval'] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders one link per CI run, in the order received', () => {
    renderSeeded([
      ciRunSummary('ci-1'),
      ciRunSummary('ci-2', { status: 'passing', commitMessage: 'Second run' }),
    ])

    const links = rowLinks()
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', '/projects/proj-1/runs/ci/ci-1')
    expect(links[0]).toHaveTextContent(/^Has failuresFix flaky checkout/)
    expect(links[1]).toHaveAttribute('href', '/projects/proj-1/runs/ci/ci-2')
    expect(links[1]).toHaveTextContent(/^No failuresSecond run/)
  })

  it('recomputes the freshness of every row when the clock moves ten seconds', () => {
    renderSeeded([
      ciRunSummary('ci-1', { lastReportedAt: '2026-10-03T11:59:55.000Z' }),
      ciRunSummary('ci-2', { lastReportedAt: '2026-10-03T11:59:40.000Z' }),
    ])

    expect(screen.getByText('Last report 5 s ago')).toBeInTheDocument()
    expect(screen.getByText('Last report 20 s ago')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(10_000)
    })

    expect(screen.getByText('Last report 15 s ago')).toBeInTheDocument()
    expect(screen.getByText('Last report 30 s ago')).toBeInTheDocument()
    expect(list).not.toHaveBeenCalled()
  })

  it('switches the unit when a row crosses a minute with the clock', () => {
    renderSeeded([ciRunSummary('ci-1', { lastReportedAt: '2026-10-03T11:59:15.000Z' })])

    expect(screen.getByText('Last report 45 s ago')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(20_000)
    })

    expect(screen.getByText('Last report 1 min ago')).toBeInTheDocument()
  })

  it('refreshes every row from one interval for the whole list and clears it on unmount', () => {
    const { unmount } = renderSeeded([
      ciRunSummary('ci-1'),
      ciRunSummary('ci-2'),
      ciRunSummary('ci-3'),
    ])

    expect(vi.getTimerCount()).toBe(1)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })

  it('names the list in the active locale', () => {
    useI18nStore.setState({ locale: 'es' })

    renderSeeded([ciRunSummary('ci-1')])

    expect(screen.getByRole('list', { name: 'Ejecuciones de CI' })).toBeInTheDocument()
  })

  it('keeps one bordered list that spans the page edges and holds no cards', () => {
    const { container } = renderSeeded([ciRunSummary('ci-1')])

    const listElement = screen.getByRole('list', { name: 'CI runs' })
    expect(listElement).toHaveClass('divide-y')
    expect(listElement.parentElement).toHaveClass('rule-bleed', 'border-y', 'border-border')
    expect(container.querySelector('[data-slot="card"]')).toBeNull()
  })
})

describe('CiRunList states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading status while the first page is in flight', () => {
    list.mockReturnValue(new Promise(() => undefined))

    renderList()

    expect(screen.getByRole('status')).toHaveTextContent('Loading runs…')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('shows an alert when the first page fails', async () => {
    list.mockRejectedValue(new Error('boom'))

    renderList()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load the runs')
    expect(alert).toHaveTextContent('Try again in a few seconds.')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('guides to the CI setup when there are no runs, without offering to create one', async () => {
    list.mockResolvedValue({ items: [] })

    renderList()

    expect(await screen.findByText('No runs yet')).toBeInTheDocument()
    expect(
      screen.getByText('Runs appear here once the results reporter is wired into the CI workflow.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'How to report results from CI' })).toHaveAttribute(
      'href',
      expect.stringContaining('#step-4-report-ci'),
    )
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders the rows once the first page arrives', async () => {
    list.mockResolvedValue({ items: [ciRunSummary('ci-1'), ciRunSummary('ci-2')] })

    renderList()

    expect(await screen.findByRole('list', { name: 'CI runs' })).toBeInTheDocument()
    expect(rowLinks()).toHaveLength(2)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
