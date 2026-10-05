import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getCiRun } from '@/features/runs/api/ci-runs.api'
import { ciRunDetail, ciRunJobRun } from '@/features/runs/test/ci-run-fixtures'
import { expectFocusRing } from '@/features/runs/test/focus-ring'
import { ApiError } from '@/lib/api-client'
import { useI18nStore } from '@/lib/i18n/store'
import { CiRunDetailPageClient } from './client'
import CiRunDetailLoading from './loading'
import CiRunDetailPage from './page'

vi.mock('@/features/runs/api/ci-runs.api', () => ({
  listCiRuns: vi.fn(),
  getCiRun: vi.fn(),
}))

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

const detail = vi.mocked(getCiRun)

function renderInQuery(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

function renderPage(projectId = 'proj-1', ciRunId = 'ci-1') {
  return renderInQuery(<CiRunDetailPageClient projectId={projectId} ciRunId={ciRunId} />)
}

function breadcrumbLinks(): [string | null, string | null][] {
  const nav = screen.getByRole('navigation', { name: /breadcrumb/i })

  return within(nav)
    .getAllByRole('link')
    .map((link) => [link.textContent, link.getAttribute('href')])
}

describe('CiRunDetailPageClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows a back button beside the breadcrumbs at every breakpoint', async () => {
    detail.mockResolvedValue(ciRunDetail([ciRunJobRun('r1', { status: 'fail', ciJobKey: 'api' })], { runNumber: 42 }))

    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'CI #42' })

    const back = screen.getByRole('button', { name: 'Back' })
    expect(back).not.toHaveClass('md:hidden')
    expect(back).not.toHaveClass('hidden')
    expect(back.parentElement).toContainElement(
      screen.getByRole('navigation', { name: /breadcrumb/i }),
    )
  })

  it('goes back through history so the runs list keeps its scroll position', async () => {
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(3)
    detail.mockResolvedValue(ciRunDetail([ciRunJobRun('r1', { status: 'fail', ciJobKey: 'api' })], { runNumber: 42 }))
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'CI #42' })
    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(mockBack).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('falls back to the runs list, the parent in the breadcrumb, for a deep link', async () => {
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(1)
    detail.mockResolvedValue(ciRunDetail([ciRunJobRun('r1', { status: 'fail', ciJobKey: 'api' })], { runNumber: 42 }))
    const user = userEvent.setup()

    renderPage()
    await screen.findByRole('heading', { level: 1, name: 'CI #42' })
    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(mockBack).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/runs')
  })

  it('keeps the back button on the page that explains a CI run cannot be shown', async () => {
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(1)
    detail.mockRejectedValue(new ApiError(404, 'CI run not found', 'not-found'))
    const user = userEvent.setup()

    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Back' }))

    expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/runs')
  })

  it('shows a loading state while the CI run is requested', () => {
    detail.mockReturnValue(new Promise(() => undefined))

    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Loading the run…')
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(detail).toHaveBeenCalledWith('ci-1', expect.any(AbortSignal))
  })

  it('renders the CI run under its breadcrumb and a single screen-reader heading', async () => {
    detail.mockResolvedValue(
      ciRunDetail([ciRunJobRun('r1', { status: 'fail', ciJobKey: 'api', name: 'Checkout', suiteName: 'Checkout' })], {
        runNumber: 42,
      }),
    )

    renderPage()

    const heading = await screen.findByRole('heading', { level: 1, name: 'CI #42' })
    expect(heading).toHaveClass('sr-only')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(breadcrumbLinks()).toStrictEqual([
      ['Projects', '/projects'],
      ['Ecommerce App', '/projects/proj-1/repository'],
      ['Runs', '/projects/proj-1/runs'],
    ])
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
    expect(within(nav).getByText('CI #42')).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { level: 2, name: 'Fix flaky checkout' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Checkout/ })).toHaveAttribute('href', '/projects/proj-1/runs/r1')
  })

  it('names the page after the short SHA when the CI run has no number', async () => {
    detail.mockResolvedValue(
      ciRunDetail([], { runNumber: undefined, commitSha: 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678' }),
    )

    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'a1b2c3d' })).toHaveClass('sr-only')
    const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
    expect(within(nav).getByText('a1b2c3d')).toHaveAttribute('aria-current', 'page')
  })

  it('names the page after the external id when there is no number and no SHA', async () => {
    detail.mockResolvedValue(
      ciRunDetail([], { runNumber: undefined, commitSha: undefined, externalId: '900' }),
    )

    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: '900' })).toHaveClass('sr-only')
  })

  it('shows not found, without retrying, when the CI run does not exist', async () => {
    detail.mockRejectedValue(new ApiError(404, 'CI run not found', 'not-found'))

    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Run not found' })).toHaveClass('sr-only')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByText('Run not found', { selector: 'p' })).toBeInTheDocument()
    expect(screen.getByText('It may have been deleted or belong to another project.')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to runs' })).toHaveAttribute(
      'href',
      '/projects/proj-1/runs?tab=actions',
    )
    expect(breadcrumbLinks()).toStrictEqual([
      ['Projects', '/projects'],
      ['Ecommerce App', '/projects/proj-1/repository'],
      ['Runs', '/projects/proj-1/runs'],
    ])
    expect(detail).toHaveBeenCalledTimes(1)
  })

  it('shows not found, without leaking the data, for a CI run of another project', async () => {
    detail.mockResolvedValue(
      ciRunDetail([ciRunJobRun('r1', { name: 'Checkout', suiteName: 'Checkout' })], {
        projectId: 'proj-2',
        commitMessage: 'Secret fix of another project',
      }),
    )

    renderPage('proj-1', 'ci-1')

    expect(await screen.findByRole('heading', { level: 1, name: 'Run not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to runs' })).toHaveAttribute(
      'href',
      '/projects/proj-1/runs?tab=actions',
    )
    expect(screen.queryByText('Secret fix of another project')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Checkout/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument()
  })

  it('shows an error, not a not found, when the request fails for another reason', async () => {
    detail.mockRejectedValue(new ApiError(500, 'Internal error'))

    renderPage()

    const alert = await screen.findByRole('alert', {}, { timeout: 4000 })
    expect(alert).toHaveTextContent('Could not load the run')
    expect(alert).toHaveTextContent('Try again in a few seconds.')
    expect(screen.queryByText('Run not found')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Could not load the run' })).toHaveClass('sr-only')
    expect(screen.getByRole('link', { name: 'Back to runs' })).toHaveAttribute(
      'href',
      '/projects/proj-1/runs?tab=actions',
    )
    expect(detail).toHaveBeenCalledTimes(2)
  })

  it('gives the way back a 44px target below md and a visible focus ring', async () => {
    detail.mockRejectedValue(new ApiError(404, 'CI run not found', 'not-found'))

    renderPage()

    const back = await screen.findByRole('link', { name: 'Back to runs' })
    expect(back).toHaveClass('h-11', 'md:h-10')
    expectFocusRing(back)
  })

  it('speaks Spanish in the breadcrumb and in the not found state', async () => {
    useI18nStore.setState({ locale: 'es' })
    detail.mockRejectedValue(new ApiError(404, 'CI run not found', 'not-found'))

    renderPage()

    expect(await screen.findByRole('heading', { level: 1, name: 'Ejecución no encontrada' })).toBeInTheDocument()
    expect(breadcrumbLinks()).toStrictEqual([
      ['Proyectos', '/projects'],
      ['Ecommerce App', '/projects/proj-1/repository'],
      ['Ejecuciones', '/projects/proj-1/runs'],
    ])
    expect(screen.getByRole('link', { name: 'Volver a las ejecuciones' })).toHaveAttribute(
      'href',
      '/projects/proj-1/runs?tab=actions',
    )
  })
})

describe('CiRunDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('hands the project and the CI run of the URL to the client', async () => {
    detail.mockResolvedValue(ciRunDetail([], { projectId: 'proj-9', runNumber: 5 }))

    renderInQuery(
      await CiRunDetailPage({ params: Promise.resolve({ id: 'proj-9', ciRunId: 'ci-1' }) }),
    )

    expect(await screen.findByRole('heading', { level: 1, name: 'CI #5' })).toBeInTheDocument()
    expect(detail).toHaveBeenCalledWith('ci-1', expect.any(AbortSignal))
    expect(breadcrumbLinks().at(-1)).toStrictEqual(['Runs', '/projects/proj-9/runs'])
  })
})

describe('CiRunDetailLoading', () => {
  it('announces that the CI run is loading', () => {
    render(<CiRunDetailLoading />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading the run…')
  })
})
