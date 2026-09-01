import { screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KpiRow } from '@/features/dashboard/components/kpi-row'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery } from '@/lib/query-test-utils'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('KpiRow', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders all 4 KPI cards', async () => {
    await act(async () => {
      renderWithQuery(<KpiRow />)
    })
    expect(screen.getByText('Runs · 7 days')).toBeInTheDocument()
    expect(screen.getByText('Pass Rate · 7 days')).toBeInTheDocument()
    expect(screen.getByText('Pending AI')).toBeInTheDocument()
    expect(screen.getByText('Coverage Gaps')).toBeInTheDocument()
  })

  it('shows correct runs-last-7-days count from mock data', async () => {
    await act(async () => {
      renderWithQuery(<KpiRow />)
    })
    // All 4 seeded runs started within 7 days of MOCK_NOW.
    const values = screen.getAllByText('4')
    expect(values.length).toBeGreaterThanOrEqual(1)
  })

  it('shows correct pending AI count from mock data', async () => {
    await act(async () => {
      renderWithQuery(<KpiRow />)
    })
    // Five of the six seeded proposals are in_review.
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('shows correct coverage gaps count from mock data', async () => {
    await act(async () => {
      renderWithQuery(<KpiRow />)
    })
    // 2 seeded coverage gaps for proj-1.
    const values = screen.getAllByText('2')
    expect(values.length).toBeGreaterThanOrEqual(1)
  })
})


