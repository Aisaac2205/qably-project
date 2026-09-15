import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SuiteMetricsEntry } from '@qably/types'
import { SuitesHealthTable } from '@/features/projects/quality/components/suites-health-table'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

const items: SuiteMetricsEntry[] = [
  {
    suiteId: 'suite-1',
    suiteName: 'Checkout',
    lastRun: {
      id: 'run-2',
      status: 'pass',
      source: 'manual',
      startedAt: '2026-06-16T10:00:00Z',
      finishedAt: '2026-06-16T10:05:00Z',
      passRate: 0.92,
    },
    trend: ['fail', 'pass', 'pass'],
  },
  {
    suiteId: 'suite-2',
    suiteName: 'Payments',
    lastRun: null,
    trend: [],
  },
]

describe('SuitesHealthTable', () => {
  it('renders a proportional pass-rate meter next to the percentage', () => {
    render(<SuitesHealthTable projectId="proj-1" items={items} />)
    const row = screen.getByRole('link', { name: 'Checkout' }).closest('tr') as HTMLElement
    expect(within(row).getByText('92%')).toBeInTheDocument()
    const meterFill = row.querySelector('[data-quality-meter-fill]') as HTMLElement
    expect(meterFill).not.toBeNull()
    expect(meterFill.style.width).toBe('92%')
  })

  it('renders a run-history strip with one tick per recent result and an accessible summary', () => {
    render(<SuitesHealthTable projectId="proj-1" items={items} />)
    const row = screen.getByRole('link', { name: 'Checkout' }).closest('tr') as HTMLElement
    const ticks = row.querySelectorAll('[data-quality-trend-tick]')
    expect(ticks).toHaveLength(3)
    ticks.forEach((tick) => expect(tick).toHaveAttribute('aria-hidden', 'true'))

    const strip = row.querySelector('[data-quality-trend-strip]') as HTMLElement
    expect(strip.getAttribute('aria-label')).toBe(
      'Recent results, oldest to newest: Fail, Pass, Pass',
    )
    expect(within(row).getByText('2/3')).toBeInTheDocument()
  })

  it('falls back to an em dash when a suite has no trend history', () => {
    render(<SuitesHealthTable projectId="proj-1" items={items} />)
    const row = screen.getByRole('link', { name: 'Payments' }).closest('tr') as HTMLElement
    expect(row.querySelector('[data-quality-trend-strip]')).toBeNull()
    const trendCell = row.querySelectorAll('td')[3]
    expect(trendCell).toHaveTextContent('—')
  })
})
