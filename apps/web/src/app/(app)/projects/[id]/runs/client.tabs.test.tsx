import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listCiRuns } from '@/features/runs/api/ci-runs.api'
import { listRuns } from '@/features/runs/api/runs.api'
import { ciRunSummary } from '@/features/runs/test/ci-run-fixtures'
import { useI18nStore } from '@/lib/i18n/store'
import { RunListPageClient } from './client'
import RunsListPage from './page'

vi.mock('@/features/runs/api/runs.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/runs/api/runs.api')>()),
  listRuns: vi.fn(),
}))

vi.mock('@/features/runs/api/ci-runs.api', () => ({
  listCiRuns: vi.fn(),
  getCiRun: vi.fn(),
}))

vi.mock('@/features/projects/hooks/use-project', () => ({
  useProject: () => ({
    project: { id: 'proj-1', name: 'Ecommerce App', hasManualCases: true },
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

const manualRuns = vi.mocked(listRuns)
const ciRuns = vi.mocked(listCiRuns)

let client: QueryClient

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function renderClient(initialTab?: 'actions' | 'manual') {
  return render(<RunListPageClient projectId="proj-1" initialTab={initialTab} />, { wrapper })
}

async function renderPage(searchParams: { tab?: string | string[] }) {
  const element = await RunsListPage({
    params: Promise.resolve({ id: 'proj-1' }),
    searchParams: Promise.resolve(searchParams),
  })

  return render(element, { wrapper })
}

function selectedTab(): string {
  const selected = screen.getAllByRole('tab').filter((tab) => tab.getAttribute('aria-selected') === 'true')

  expect(selected).toHaveLength(1)

  return selected[0].textContent ?? ''
}

describe('the runs page tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    ciRuns.mockResolvedValue({ items: [ciRunSummary('ci-1')] })
    manualRuns.mockResolvedValue({ items: [] })
  })

  describe('which tab opens', () => {
    it.each<[string, { tab?: string | string[] }, string]>([
      ['no tab', {}, 'Actions'],
      ['tab=actions', { tab: 'actions' }, 'Actions'],
      ['tab=manual', { tab: 'manual' }, 'Manual'],
      ['an unknown tab', { tab: 'foo' }, 'Actions'],
      ['an empty tab', { tab: '' }, 'Actions'],
      ['a tab in another case', { tab: 'MANUAL' }, 'Actions'],
      ['a repeated tab starting with manual', { tab: ['manual', 'actions'] }, 'Actions'],
      ['a repeated tab starting with actions', { tab: ['actions', 'manual'] }, 'Actions'],
    ])('opens the right one for %s', async (_label, searchParams, expected) => {
      await renderPage(searchParams)

      expect(selectedTab()).toBe(expected)
    })

    it('defaults to Actions when the client gets no initial tab', () => {
      renderClient()

      expect(selectedTab()).toBe('Actions')
    })

    it('switches at once when the user picks the other tab', async () => {
      const user = userEvent.setup()
      renderClient()

      await user.click(screen.getByRole('tab', { name: 'Manual' }))

      expect(selectedTab()).toBe('Manual')
    })
  })

  describe('what mounts', () => {
    it('mounts only the Actions panel by default and never asks for the manual runs', async () => {
      await renderPage({})

      expect(await screen.findByRole('link', { name: /Fix flaky checkout/ })).toHaveAttribute(
        'href',
        '/projects/proj-1/runs/ci/ci-1',
      )
      expect(ciRuns).toHaveBeenCalledWith(
        { projectId: 'proj-1', limit: 25, cursor: undefined },
        expect.any(AbortSignal),
      )
      expect(manualRuns).not.toHaveBeenCalled()
      expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    })

    it('mounts only the Manual panel for tab=manual, ungrouped, and never asks for the CI runs', async () => {
      await renderPage({ tab: 'manual' })

      expect(await screen.findByText('Run your manual cases')).toBeInTheDocument()
      expect(manualRuns).toHaveBeenCalledWith(
        { projectId: 'proj-1', source: undefined, limit: 25, cursor: undefined, ungrouped: true },
        expect.any(AbortSignal),
      )
      expect(ciRuns).not.toHaveBeenCalled()
      expect(screen.queryByRole('link', { name: /Fix flaky checkout/ })).not.toBeInTheDocument()
      expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    })

    it('mounts the manual runs only once the Manual tab is activated', async () => {
      const user = userEvent.setup()
      renderClient()
      await screen.findByRole('link', { name: /Fix flaky checkout/ })
      expect(manualRuns).not.toHaveBeenCalled()

      await user.click(screen.getByRole('tab', { name: 'Manual' }))

      expect(await screen.findByText('Run your manual cases')).toBeInTheDocument()
      expect(manualRuns).toHaveBeenCalledTimes(1)
      expect(manualRuns).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: 'proj-1', ungrouped: true }),
        expect.any(AbortSignal),
      )
      expect(screen.queryByRole('link', { name: /Fix flaky checkout/ })).not.toBeInTheDocument()
    })
  })

  describe('the keyboard', () => {
    it('moves the focus with ArrowRight without opening the tab', async () => {
      const user = userEvent.setup()
      renderClient()
      screen.getByRole('tab', { name: 'Actions' }).focus()

      await user.keyboard('{ArrowRight}')

      expect(screen.getByRole('tab', { name: 'Manual' })).toHaveFocus()
      expect(selectedTab()).toBe('Actions')
    })

    it('moves the focus back with ArrowLeft', async () => {
      const user = userEvent.setup()
      renderClient('manual')
      screen.getByRole('tab', { name: 'Manual' }).focus()

      await user.keyboard('{ArrowLeft}')

      expect(screen.getByRole('tab', { name: 'Actions' })).toHaveFocus()
      expect(selectedTab()).toBe('Manual')
    })

    it.each<[string, string]>([
      ['Enter', '{Enter}'],
      ['Space', ' '],
    ])('opens the focused tab with %s', async (_label, key) => {
      const user = userEvent.setup()
      renderClient()
      screen.getByRole('tab', { name: 'Actions' }).focus()
      await user.keyboard('{ArrowRight}')

      await user.keyboard(key)

      expect(selectedTab()).toBe('Manual')
    })

    it('goes from the selected tab straight to the first link of the panel, not to the panel itself', async () => {
      const user = userEvent.setup()
      renderClient()
      const firstRow = await screen.findByRole('link', { name: /Fix flaky checkout/ })
      screen.getByRole('tab', { name: 'Actions' }).focus()

      await user.tab()

      expect(firstRow).toHaveFocus()
    })

    it.each<['actions' | 'manual', string]>([
      ['actions', 'Actions'],
      ['manual', 'Manual'],
    ])('keeps the %s panel out of the tab sequence but able to take programmatic focus', (initialTab, name) => {
      renderClient(initialTab)

      const panel = screen.getByRole('tabpanel', { name })

      expect(panel).toHaveAttribute('tabindex', '-1')
      panel.focus()
      expect(panel).toHaveFocus()
    })
  })

  describe('the names', () => {
    it('names the list of tabs and the tabs without counts', () => {
      renderClient()

      expect(screen.getByRole('tablist', { name: 'Run source' })).toBeInTheDocument()
      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toStrictEqual(['Actions', 'Manual'])
    })

    it('names the list of tabs in Spanish', () => {
      useI18nStore.setState({ locale: 'es' })

      renderClient()

      expect(screen.getByRole('tablist', { name: 'Origen de las ejecuciones' })).toBeInTheDocument()
      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toStrictEqual(['Acciones', 'Manual'])
    })

    it('labels each panel with its own tab', async () => {
      const user = userEvent.setup()
      renderClient()
      expect(screen.getByRole('tabpanel', { name: 'Actions' })).toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: 'Manual' }))

      expect(screen.getByRole('tabpanel', { name: 'Manual' })).toBeInTheDocument()
      expect(screen.queryByRole('tabpanel', { name: 'Actions' })).not.toBeInTheDocument()
    })
  })
})
