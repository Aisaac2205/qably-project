import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunRecord } from '@qably/types'
import { getCiRun } from '@/features/runs/api/ci-runs.api'
import { getRun } from '@/features/runs/api/runs.api'
import { ciRunDetail } from '@/features/runs/test/ci-run-fixtures'
import { ApiError } from '@/lib/api-client'
import { useI18nStore } from '@/lib/i18n/store'
import { runFixtures } from '@/test/runs-api-stub'
import { RunDetailPageClient } from './client'

vi.mock('@/features/runs/api/runs.api', async () => ({
  ...(await import('@/test/runs-api-stub')),
  getRun: vi.fn(),
}))

vi.mock('@/features/runs/api/ci-runs.api', () => ({
  listCiRuns: vi.fn(),
  getCiRun: vi.fn(),
}))

vi.mock('@/features/projects/suites/api/suites.api', async () => await import('@/test/suites-api-stub'))

vi.mock('@/features/projects/hooks/use-project', () => ({
  useProject: () => ({
    project: { id: 'proj-1', name: 'Ecommerce App' },
    isLoading: false,
    isError: false,
  }),
}))

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const mockPush = vi.fn()
const mockBack = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}))

const run = vi.mocked(getRun)
const ciRun = vi.mocked(getCiRun)

function runRecord(overrides: Partial<RunRecord> = {}): RunRecord {
  return { ...structuredClone(runFixtures[0]), ...overrides }
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={client}>
      <RunDetailPageClient projectId="proj-1" runId="run-12" />
    </QueryClientProvider>,
  )
}

function breadcrumb() {
  return screen.getByRole('navigation', { name: /breadcrumb/i })
}

function crumbLinks(): [string | null, string | null][] {
  return within(breadcrumb())
    .getAllByRole('link')
    .map((link) => [link.textContent, link.getAttribute('href')])
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('the suite breadcrumb of a run that belongs to a CI run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('names the CI run between the runs list and the suite', async () => {
    run.mockResolvedValue(runRecord({ ciRunId: 'c1' }))
    ciRun.mockResolvedValue(ciRunDetail([], { id: 'c1', runNumber: 42 }))

    renderPage()

    expect(await screen.findByRole('link', { name: 'CI #42' })).toHaveAttribute(
      'href',
      '/projects/proj-1/runs/ci/c1',
    )
    expect(crumbLinks()).toStrictEqual([
      ['Projects', '/projects'],
      ['Ecommerce App', '/projects/proj-1/repository'],
      ['Runs', '/projects/proj-1/runs'],
      ['CI #42', '/projects/proj-1/runs/ci/c1'],
    ])
    expect(within(breadcrumb()).getByText('Run #12')).toHaveAttribute('aria-current', 'page')
    expect(ciRun).toHaveBeenCalledTimes(1)
    expect(ciRun).toHaveBeenCalledWith('c1', expect.any(AbortSignal))
  })

  it('puts the CI run after the runs list and before the suite', async () => {
    run.mockResolvedValue(runRecord({ ciRunId: 'c1' }))
    ciRun.mockResolvedValue(ciRunDetail([], { id: 'c1', runNumber: 42 }))

    renderPage()
    const ciLink = await screen.findByRole('link', { name: 'CI #42' })

    const runsLink = within(breadcrumb()).getByRole('link', { name: 'Runs' })
    const suite = within(breadcrumb()).getByText('Run #12')
    expect(runsLink.compareDocumentPosition(ciLink) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(ciLink.compareDocumentPosition(suite) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('falls back to the short SHA when the CI run has no number', async () => {
    run.mockResolvedValue(runRecord({ ciRunId: 'c1' }))
    ciRun.mockResolvedValue(
      ciRunDetail([], {
        id: 'c1',
        runNumber: undefined,
        commitSha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678',
      }),
    )

    renderPage()

    expect(await screen.findByRole('link', { name: 'a1b2c3d' })).toHaveAttribute(
      'href',
      '/projects/proj-1/runs/ci/c1',
    )
  })

  it('falls back to the external id when the CI run has neither number nor SHA', async () => {
    run.mockResolvedValue(runRecord({ ciRunId: 'c1' }))
    ciRun.mockResolvedValue(
      ciRunDetail([], { id: 'c1', runNumber: undefined, commitSha: undefined, externalId: '900' }),
    )

    renderPage()

    expect(await screen.findByRole('link', { name: '900' })).toHaveAttribute(
      'href',
      '/projects/proj-1/runs/ci/c1',
    )
  })

  it('speaks Spanish in the surrounding levels', async () => {
    useI18nStore.setState({ locale: 'es' })
    run.mockResolvedValue(runRecord({ ciRunId: 'c1' }))
    ciRun.mockResolvedValue(ciRunDetail([], { id: 'c1', runNumber: 42 }))

    renderPage()
    await screen.findByRole('link', { name: 'CI #42' })

    expect(crumbLinks().map(([label]) => label)).toStrictEqual([
      'Proyectos',
      'Ecommerce App',
      'Ejecuciones',
      'CI #42',
    ])
  })
})

describe('the suite breadcrumb when there is no CI run to show', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('asks for no CI run and keeps the breadcrumb of a run that is not linked', async () => {
    run.mockResolvedValue(runRecord())

    renderPage()
    await screen.findByRole('heading', { level: 3, name: 'Run #12' })
    await settle()

    expect(ciRun).not.toHaveBeenCalled()
    expect(crumbLinks()).toStrictEqual([
      ['Projects', '/projects'],
      ['Ecommerce App', '/projects/proj-1/repository'],
      ['Runs', '/projects/proj-1/runs?tab=manual'],
    ])
    expect(within(breadcrumb()).getByText('Run #12')).toHaveAttribute('aria-current', 'page')
  })

  it('asks for no CI run while the run itself is still loading', async () => {
    run.mockReturnValue(new Promise(() => undefined))

    renderPage()
    await settle()

    expect(ciRun).not.toHaveBeenCalled()
  })

  it('shows the page without that level while the CI run is loading', async () => {
    run.mockResolvedValue(runRecord({ ciRunId: 'c1' }))
    ciRun.mockReturnValue(new Promise(() => undefined))

    renderPage()

    expect(await screen.findByRole('heading', { level: 3, name: 'Run #12' })).toBeInTheDocument()
    await waitFor(() => expect(ciRun).toHaveBeenCalledTimes(1))
    expect(crumbLinks().map(([label]) => label)).toStrictEqual(['Projects', 'Ecommerce App', 'Runs'])
    expect(within(breadcrumb()).getByText('Run #12')).toHaveAttribute('aria-current', 'page')
  })

  it('drops that level and keeps the page when the CI run is not found', async () => {
    run.mockResolvedValue(runRecord({ ciRunId: 'c1' }))
    ciRun.mockRejectedValue(new ApiError(404, 'CI run not found', 'not-found'))

    renderPage()

    expect(await screen.findByRole('heading', { level: 3, name: 'Run #12' })).toBeInTheDocument()
    await waitFor(() => expect(ciRun).toHaveBeenCalledTimes(1))
    await settle()
    expect(crumbLinks().map(([label]) => label)).toStrictEqual(['Projects', 'Ecommerce App', 'Runs'])
    expect(within(breadcrumb()).getByText('Run #12')).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('drops that level and keeps the page when the request fails', async () => {
    run.mockResolvedValue(runRecord({ ciRunId: 'c1' }))
    ciRun.mockRejectedValue(new ApiError(500, 'Internal error'))

    renderPage()

    expect(await screen.findByRole('heading', { level: 3, name: 'Run #12' })).toBeInTheDocument()
    await waitFor(() => expect(ciRun).toHaveBeenCalledTimes(2), { timeout: 4000 })
    await settle()
    expect(crumbLinks().map(([label]) => label)).toStrictEqual(['Projects', 'Ecommerce App', 'Runs'])
    expect(within(breadcrumb()).getByText('Run #12')).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('the way back to the runs list', () => {
  const ACTIONS_LIST = '/projects/proj-1/runs'
  const MANUAL_LIST = '/projects/proj-1/runs?tab=manual'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function runsCrumbHref(): string | null {
    return within(breadcrumb()).getByRole('link', { name: 'Runs' }).getAttribute('href')
  }

  it('sends a run without a CI run to the Manual tab, where the runs without a CI run are listed', async () => {
    run.mockResolvedValue(runRecord())

    renderPage()
    await screen.findByRole('heading', { level: 3, name: 'Run #12' })

    expect(runsCrumbHref()).toBe(MANUAL_LIST)
  })

  it('keeps the default tab for a run that belongs to a CI run and leaves the CI level alone', async () => {
    run.mockResolvedValue(runRecord({ ciRunId: 'c1' }))
    ciRun.mockResolvedValue(ciRunDetail([], { id: 'c1', runNumber: 42 }))

    renderPage()
    const ciLink = await screen.findByRole('link', { name: 'CI #42' })

    expect(runsCrumbHref()).toBe(ACTIONS_LIST)
    expect(ciLink).toHaveAttribute('href', '/projects/proj-1/runs/ci/c1')
  })

  it('keeps the default tab for a linked run while its CI run is still loading', async () => {
    run.mockResolvedValue(runRecord({ ciRunId: 'c1' }))
    ciRun.mockReturnValue(new Promise(() => undefined))

    renderPage()
    await screen.findByRole('heading', { level: 3, name: 'Run #12' })
    await waitFor(() => expect(ciRun).toHaveBeenCalledTimes(1))

    expect(runsCrumbHref()).toBe(ACTIONS_LIST)
  })

  it('keeps the default tab for a linked run whose CI run cannot be shown', async () => {
    run.mockResolvedValue(runRecord({ ciRunId: 'c1' }))
    ciRun.mockRejectedValue(new ApiError(404, 'CI run not found', 'not-found'))

    renderPage()
    await screen.findByRole('heading', { level: 3, name: 'Run #12' })
    await waitFor(() => expect(ciRun).toHaveBeenCalledTimes(1))
    await settle()

    expect(runsCrumbHref()).toBe(ACTIONS_LIST)
  })

  it('sends the not found page to the Manual tab too, in the breadcrumb and in the link back', async () => {
    run.mockRejectedValue(new ApiError(404, 'Run not found', 'not-found'))

    renderPage()
    await screen.findByText('Not found', { selector: 'p' })

    const links = screen.getAllByRole('link', { name: 'Runs' })
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link).toHaveAttribute('href', MANUAL_LIST)
    }
  })
})

describe('the back button of a run that belongs to a CI run', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to its CI run, the parent in the breadcrumb, for a deep link', async () => {
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(1)
    run.mockResolvedValue(runRecord({ ciRunId: 'c1' }))
    ciRun.mockResolvedValue(ciRunDetail([], { id: 'c1', runNumber: 42 }))
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('link', { name: 'CI #42' })
    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(mockBack).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/runs/ci/c1')
  })

  it('goes back through history, so the list or the CI run it came from keeps its scroll position', async () => {
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(4)
    run.mockResolvedValue(runRecord({ ciRunId: 'c1' }))
    ciRun.mockResolvedValue(ciRunDetail([], { id: 'c1', runNumber: 42 }))
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('link', { name: 'CI #42' })
    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(mockBack).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
  })
})
