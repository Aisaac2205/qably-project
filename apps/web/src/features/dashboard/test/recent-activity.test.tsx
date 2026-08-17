import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RecentActivity } from '@/features/dashboard/components/recent-activity'
import { __resetStore } from '@/lib/mock-store'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('RecentActivity', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders section headings for recent runs and recent pipelines', async () => {
    await act(async () => {
      render(<RecentActivity />)
    })
    expect(screen.getByText('Recent runs')).toBeInTheDocument()
    expect(screen.getByText('Recent pipelines')).toBeInTheDocument()
  })

  it('shows recent runs from mock data', async () => {
    await act(async () => {
      render(<RecentActivity />)
    })
    // Should show at least one run name
    const runTitles = screen.getAllByText(/Run #/)
    expect(runTitles.length).toBeGreaterThan(0)
  })

  it('shows recent CI runs in pipelines section', async () => {
    await act(async () => {
      render(<RecentActivity />)
    })
    // After unification, pipelines section shows CI runs (github_actions source)
    // run-10 has commitMessage from enriched CI metadata
    expect(screen.getByText(/checkout button not disabling/i)).toBeInTheDocument()
  })
})
