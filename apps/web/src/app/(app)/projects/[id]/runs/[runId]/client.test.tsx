import { screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
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

describe('RunDetailPageClient', () => {
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
