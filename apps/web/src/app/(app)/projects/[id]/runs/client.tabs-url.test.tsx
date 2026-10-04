import { act, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listCiRuns } from '@/features/runs/api/ci-runs.api'
import { listRuns } from '@/features/runs/api/runs.api'
import { ciRunSummary } from '@/features/runs/test/ci-run-fixtures'
import { RunListPageClient } from './client'
import RunsListPage from './page'

const navigation = vi.hoisted(() => ({ replace: vi.fn() }))

type ValueChange = (value: unknown, eventDetails: { reason: string }) => void

const tabsRoot = vi.hoisted(() => ({ onValueChange: undefined as ValueChange | undefined }))

vi.mock('@/components/ui/tabs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/tabs')>()

  return {
    ...actual,
    Tabs: (props: React.ComponentProps<typeof actual.Tabs>) => {
      tabsRoot.onValueChange = props.onValueChange as ValueChange | undefined
      return <actual.Tabs {...props} />
    },
  }
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => '/projects/proj-1/runs',
  useSearchParams: () => new URLSearchParams(),
}))

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

let client: QueryClient

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function renderClient(initialTab?: 'actions' | 'manual') {
  return render(<RunListPageClient projectId="proj-1" initialTab={initialTab} />, { wrapper })
}

function selectedTab(): string {
  const selected = screen.getAllByRole('tab').filter((tab) => tab.getAttribute('aria-selected') === 'true')

  expect(selected).toHaveLength(1)

  return selected[0].textContent ?? ''
}

describe('the runs page tabs and the address bar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    vi.mocked(listCiRuns).mockResolvedValue({ items: [ciRunSummary('ci-1')] })
    vi.mocked(listRuns).mockResolvedValue({ items: [] })
  })

  describe('on mount', () => {
    it.each<['actions' | 'manual' | undefined]>([[undefined], ['actions'], ['manual']])(
      'does not rewrite the URL (initial tab %s)',
      async (initialTab) => {
        renderClient(initialTab)
        await screen.findByRole('tablist')

        expect(navigation.replace).not.toHaveBeenCalled()
      },
    )

    it('does not rewrite the URL when the page resolves the tab from it', async () => {
      const element = await RunsListPage({
        params: Promise.resolve({ id: 'proj-1' }),
        searchParams: Promise.resolve({ tab: 'manual' }),
      })

      render(element, { wrapper })
      await screen.findByRole('tablist')

      expect(selectedTab()).toBe('Manual')
      expect(navigation.replace).not.toHaveBeenCalled()
    })
  })

  describe('when the user picks a tab', () => {
    it('replaces the URL with tab=manual, without scrolling, when the user picks Manual', async () => {
      const user = userEvent.setup()
      renderClient()

      await user.click(screen.getByRole('tab', { name: 'Manual' }))

      expect(navigation.replace).toHaveBeenCalledTimes(1)
      expect(navigation.replace).toHaveBeenCalledWith('/projects/proj-1/runs?tab=manual', { scroll: false })
    })

    it('replaces the URL with tab=actions when the user goes back to Actions', async () => {
      const user = userEvent.setup()
      renderClient('manual')

      await user.click(screen.getByRole('tab', { name: 'Actions' }))

      expect(navigation.replace).toHaveBeenCalledTimes(1)
      expect(navigation.replace).toHaveBeenCalledWith('/projects/proj-1/runs?tab=actions', { scroll: false })
    })

    it('does not touch the URL when the user picks the tab that is already open', async () => {
      const user = userEvent.setup()
      renderClient('manual')

      await user.click(screen.getByRole('tab', { name: 'Manual' }))

      expect(navigation.replace).not.toHaveBeenCalled()
      expect(selectedTab()).toBe('Manual')
    })

    it('switches the tab at once, without waiting for the URL to come back', async () => {
      const user = userEvent.setup()
      renderClient()

      await user.click(screen.getByRole('tab', { name: 'Manual' }))

      expect(selectedTab()).toBe('Manual')
    })

    it('does not write the URL while the arrow keys only move the focus', async () => {
      const user = userEvent.setup()
      renderClient()
      screen.getByRole('tab', { name: 'Actions' }).focus()

      await user.keyboard('{ArrowRight}')

      expect(selectedTab()).toBe('Actions')
      expect(navigation.replace).not.toHaveBeenCalled()
    })

    it.each<[string, string]>([
      ['Enter', '{Enter}'],
      ['Space', ' '],
    ])('writes the URL once when %s opens the focused tab', async (_label, key) => {
      const user = userEvent.setup()
      renderClient()
      screen.getByRole('tab', { name: 'Actions' }).focus()
      await user.keyboard('{ArrowRight}')

      await user.keyboard(key)

      expect(selectedTab()).toBe('Manual')
      expect(navigation.replace).toHaveBeenCalledTimes(1)
      expect(navigation.replace).toHaveBeenCalledWith('/projects/proj-1/runs?tab=manual', { scroll: false })
    })
  })

  describe('when the change is not the user', () => {
    it.each(['initial', 'disabled', 'missing'])(
      'ignores the automatic change Base UI reports as %s',
      (reason) => {
        renderClient()

        act(() => {
          tabsRoot.onValueChange?.('manual', { reason })
        })

        expect(selectedTab()).toBe('Actions')
        expect(navigation.replace).not.toHaveBeenCalled()
      },
    )

    it('follows the URL when it changes under the page, without writing it back', () => {
      const { rerender } = renderClient('manual')
      expect(selectedTab()).toBe('Manual')

      rerender(<RunListPageClient projectId="proj-1" initialTab="actions" />)

      expect(selectedTab()).toBe('Actions')
      expect(navigation.replace).not.toHaveBeenCalled()
    })
  })
})
