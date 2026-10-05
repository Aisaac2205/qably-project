import { screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { RunDetailPageClient } from './client'
import { renderWithQuery } from '@/lib/query-test-utils'

vi.mock('@/features/runs/api/runs.api', async () =>
  await import('@/test/runs-api-stub'),
)
vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)
vi.mock('@/features/projects/hooks/use-project', () => ({
  useProject: () => ({
    project: { id: 'proj-1', name: 'Ecommerce App' },
    isLoading: false,
    isError: false,
  }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

const mockPush = vi.fn()
const mockBack = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
}))

describe('RunDetailPageClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    mockPush.mockClear()
    mockBack.mockClear()
  })

  it('shows a back button beside the breadcrumbs at every breakpoint', async () => {
    await act(async () => {
      renderWithQuery(<RunDetailPageClient projectId="proj-1" runId="run-12" />)
    })

    const back = screen.getByRole('button', { name: 'Back' })
    expect(back).not.toHaveClass('md:hidden')
    expect(back).not.toHaveClass('hidden')
    expect(back.parentElement).toContainElement(
      screen.getByRole('navigation', { name: /breadcrumb/i }),
    )
  })

  it('goes back through history when the tab has earlier entries', async () => {
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(3)
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(<RunDetailPageClient projectId="proj-1" runId="run-12" />)
    })

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(mockBack).toHaveBeenCalledTimes(1)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('falls back to the Manual runs list for a deep link, the parent of a run without a CI run', async () => {
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(1)
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(<RunDetailPageClient projectId="proj-1" runId="run-12" />)
    })

    await user.click(screen.getByRole('button', { name: 'Back' }))

    expect(mockBack).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/projects/proj-1/runs?tab=manual')
  })

  it('shows the loading state before the run query settles', async () => {
    renderWithQuery(<RunDetailPageClient projectId="proj-1" runId="run-404" />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading runs…')).toBeInTheDocument()
    expect(screen.queryByText('Not found')).not.toBeInTheDocument()

    await act(async () => {})
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  })

  it('shows "Not found" once the run query settles with no match', async () => {
    renderWithQuery(<RunDetailPageClient projectId="proj-1" runId="run-404" />)
    await act(async () => {})
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(screen.getByText('Not found', { selector: 'p' })).toBeInTheDocument()
  })

  it('renders the run detail once the run query resolves with a match', async () => {
    await act(async () => {
      renderWithQuery(<RunDetailPageClient projectId="proj-1" runId="run-12" />)
    })

    const nav = screen.getByRole('navigation', { name: /breadcrumb/i })
    expect(nav).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: 'Run #12' })).toBeInTheDocument()
  })
})
