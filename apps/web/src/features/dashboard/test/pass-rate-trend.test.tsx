import { screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery } from '@/lib/query-test-utils'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

import { PassRateTrend } from '@/features/dashboard/components/pass-rate-trend'

describe('PassRateTrend', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders the title "Pass rate trend"', async () => {
    await act(async () => {
      renderWithQuery(<PassRateTrend />)
    })
    expect(screen.getByText('Pass rate trend')).toBeInTheDocument()
  })

  it('renders the Pass Rate KPI percentage', async () => {
    await act(async () => {
      renderWithQuery(<PassRateTrend />)
    })
    // With MOCK_NOW at 2026-06-16, runs 11/10/9 all fall within 7 days → avg of (100+67+100)/3 = 89%
    const pctElements = screen.getAllByText('89%')
    expect(pctElements.length).toBeGreaterThanOrEqual(1)
  })

  it('renders the trend arrow and label', async () => {
    await act(async () => {
      renderWithQuery(<PassRateTrend />)
    })
    // trend = 89 - 0 = 89% (positive), displayed alongside the KPI
    expect(screen.getByText('vs prior 7d')).toBeInTheDocument()
  })

  it('renders an accessible pass-rate chart', async () => {
    await act(async () => {
      renderWithQuery(<PassRateTrend />)
    })
    expect(screen.getByRole('img', { name: 'Pass rate trend chart' })).toBeInTheDocument()
  })

  it('renders the period selector', async () => {
    await act(async () => {
      renderWithQuery(<PassRateTrend />)
    })
    expect(screen.getByText('7 days')).toBeInTheDocument()
  })
})
