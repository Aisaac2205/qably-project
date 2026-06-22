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

  it('renders three section headings', async () => {
    await act(async () => {
      render(<RecentActivity />)
    })
    expect(screen.getByText('Recent runs')).toBeInTheDocument()
    expect(screen.getByText('Pending AI cases')).toBeInTheDocument()
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

  it('shows pending AI cases from mock data', async () => {
    await act(async () => {
      render(<RecentActivity />)
    })
    // Should show pending AI case names
    expect(screen.getByText('Checkout with empty cart blocked')).toBeInTheDocument()
    expect(screen.getByText('Discount code reduces total')).toBeInTheDocument()
  })

  it('shows empty pipelines when no seed data', async () => {
    await act(async () => {
      render(<RecentActivity />)
    })
    // Pipelines section shows empty state after mockPipelineRuns removal
    expect(screen.getByText('No pipelines yet')).toBeInTheDocument()
  })
})
