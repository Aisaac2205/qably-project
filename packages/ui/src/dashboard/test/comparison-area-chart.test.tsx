import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ComparisonAreaChart, type ComparisonAreaPoint } from '../comparison-area-chart'

vi.mock('../../chart/use-coarse-pointer', () => ({
  useCoarsePointer: vi.fn(() => false),
}))

import { useCoarsePointer } from '../../chart/use-coarse-pointer'

const points: readonly ComparisonAreaPoint[] = [
  { id: 'd1', label: 'Mon', current: 92, previous: 88, runs: 40, failedRuns: 3 },
  { id: 'd2', label: 'Tue', current: null, previous: 85, runs: 0, failedRuns: 0 },
  { id: 'd3', label: 'Wed', current: 90, previous: null, runs: 35, failedRuns: 4 },
]

const defaultProps = {
  label: 'Pass rate, last 7 days',
  emptyLabel: 'No runs in this period',
  domain: [80, 100] as const,
  ticks: [80, 90, 100],
  valueFormatter: (value: number) => `${value}%`,
  seriesLabels: { current: 'This period', previous: 'Previous period' },
  metricLabels: { runs: 'Runs', failedRuns: 'Failed runs' },
}

afterEach(() => {
  vi.mocked(useCoarsePointer).mockReturnValue(false)
})

describe('ComparisonAreaChart', () => {
  it('renders the empty label instead of an empty chart when there are no points', () => {
    render(<ComparisonAreaChart {...defaultProps} points={[]} />)

    expect(screen.getByText('No runs in this period')).toBeInTheDocument()
  })

  it('renders an area for the current series and a dashed line for the previous series', () => {
    const { container } = render(<ComparisonAreaChart {...defaultProps} points={points} />)

    expect(container.querySelector('.recharts-area-curve')).toBeInTheDocument()
    const line = container.querySelector('.recharts-line-curve')
    expect(line).toHaveAttribute('stroke-dasharray', '5 5')
  })

  it('breaks the current series into a gap instead of interpolating across a null day', () => {
    const { container } = render(<ComparisonAreaChart {...defaultProps} points={points} />)

    const area = container.querySelector('.recharts-area-curve')
    const commands = (area?.getAttribute('d') ?? '').match(/M/g) ?? []
    expect(commands.length).toBeGreaterThan(1)
  })

  it('mirrors the series in an sr-only table including runs and failed runs', () => {
    render(<ComparisonAreaChart {...defaultProps} points={points} />)

    const table = screen.getByRole('table')
    expect(table).toHaveClass('sr-only')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(within(rows[0] as HTMLElement).getByText('Mon')).toBeInTheDocument()
    expect(within(rows[0] as HTMLElement).getByText('92%')).toBeInTheDocument()
    expect(within(rows[0] as HTMLElement).getByText('88%')).toBeInTheDocument()
    expect(within(rows[0] as HTMLElement).getByText('40')).toBeInTheDocument()
    expect(within(rows[0] as HTMLElement).getByText('3')).toBeInTheDocument()
  })

  it('is keyboard reachable via the native Recharts accessibility layer', () => {
    const { container } = render(<ComparisonAreaChart {...defaultProps} points={points} />)

    expect(container.querySelector('.recharts-surface')).toHaveAttribute('tabindex', '0')
  })

  it('renders a polite live region for the active point announcer', () => {
    render(<ComparisonAreaChart {...defaultProps} points={points} />)

    const status = screen.getByRole('status')
    expect(status).toHaveClass('sr-only')
    expect(status).toHaveAttribute('aria-live', 'polite')
  })

  it('resolves a hover trigger on a fine pointer', () => {
    vi.mocked(useCoarsePointer).mockReturnValue(false)
    const { container } = render(<ComparisonAreaChart {...defaultProps} points={points} />)

    expect(container.querySelector('[data-slot="comparison-area-chart"]')).toHaveAttribute(
      'data-touch-trigger',
      'hover',
    )
  })

  it('resolves a click trigger on a coarse pointer', () => {
    vi.mocked(useCoarsePointer).mockReturnValue(true)
    const { container } = render(<ComparisonAreaChart {...defaultProps} points={points} />)

    expect(container.querySelector('[data-slot="comparison-area-chart"]')).toHaveAttribute(
      'data-touch-trigger',
      'click',
    )
  })

  it('fills its sized parent instead of relying on ResponsiveContainer to measure a 0-height ancestor', () => {
    const { container } = render(<ComparisonAreaChart {...defaultProps} points={points} className="h-full" />)

    const wrapper = container.querySelector('[data-slot="comparison-area-chart"]')
    expect(wrapper).toHaveClass('h-full', 'w-full')
    const chart = container.querySelector('[data-slot="chart"]')
    expect(chart).toHaveClass('h-full', 'w-full')
  })
})
