import { screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RecentActivity } from '@/features/dashboard/components/recent-activity'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery } from '@/lib/query-test-utils'
import { useI18nStore } from '@/lib/i18n'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)
vi.mock('@/features/runs/api/runs.api', async () =>
  await import('@/test/runs-api-stub'),
)

describe('RecentActivity', () => {
  beforeEach(() => {
    __resetStore()
    useI18nStore.setState({ locale: 'en' })
  })

  it('renders section headings for recent runs and recent pipelines', async () => {
    await act(async () => {
      renderWithQuery(<RecentActivity />)
    })
    expect(screen.getByText('Recent runs')).toBeInTheDocument()
    expect(screen.getByText('Recent pipelines')).toBeInTheDocument()
  })

  it('shows recent runs from mock data', async () => {
    await act(async () => {
      renderWithQuery(<RecentActivity />)
    })
    // Should show at least one run name
    const runTitles = screen.getAllByText(/Run #/)
    expect(runTitles.length).toBeGreaterThan(0)
  })

  it('shows recent CI runs in pipelines section', async () => {
    await act(async () => {
      renderWithQuery(<RecentActivity />)
    })
    // Pipelines section shows CI runs (github_actions source)
    // run-10 has commitMessage from enriched CI metadata
    expect(screen.getByText(/checkout button not disabling/i)).toBeInTheDocument()
  })

  it('translates the view-all links instead of hardcoding English', async () => {
    useI18nStore.setState({ locale: 'es' })
    await act(async () => {
      renderWithQuery(<RecentActivity />)
    })
    expect(screen.getAllByText('Ver todo').length).toBeGreaterThan(0)
    expect(screen.queryByText('View all')).not.toBeInTheDocument()
  })
})
