import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KpiRow } from '@/features/dashboard/components/kpi-row'
import { __resetStore } from '@/lib/mock-store'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('KpiRow', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('renders all 5 KPI cards', async () => {
    await act(async () => {
      render(<KpiRow />)
    })
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Test Suites')).toBeInTheDocument()
    expect(screen.getByText('Runs (7d)')).toBeInTheDocument()
    expect(screen.getByText('Pass Rate (7d)')).toBeInTheDocument()
    expect(screen.getByText('Pending AI')).toBeInTheDocument()
  })

  it('shows correct project count from mock data', async () => {
    await act(async () => {
      render(<KpiRow />)
    })
    // 4 projects in mock data (the Projects KPI card has value "4")
    const values = screen.getAllByText('4')
    expect(values.length).toBeGreaterThanOrEqual(1)
  })

  it('shows correct suite count from mock data', async () => {
    await act(async () => {
      render(<KpiRow />)
    })
    // 12+8+6+5 = 31
    expect(screen.getByText('31')).toBeInTheDocument()
  })

  it('shows correct pending AI count from mock data', async () => {
    await act(async () => {
      render(<KpiRow />)
    })
    // 3 pending AI cases
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
