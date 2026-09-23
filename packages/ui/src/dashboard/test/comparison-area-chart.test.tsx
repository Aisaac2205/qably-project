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

  it('connects the current and previous series across a null day into one continuous curve', () => {
    const { container } = render(<ComparisonAreaChart {...defaultProps} points={points} />)

    const area = container.querySelector('.recharts-area-curve')
    const areaCommands = (area?.getAttribute('d') ?? '').match(/M/g) ?? []
    expect(areaCommands.length).toBe(1)

    const line = container.querySelector('.recharts-line-curve')
    const lineCommands = (line?.getAttribute('d') ?? '').match(/M/g) ?? []
    expect(lineCommands.length).toBe(1)
  })

  it('still shows a dash in the sr-only table for a null day, without fabricating data', () => {
    render(<ComparisonAreaChart {...defaultProps} points={points} />)

    const table = screen.getByRole('table')
    const rows = within(table).getAllByRole('row').slice(1)
    expect(within(rows[1] as HTMLElement).getByText('—')).toBeInTheDocument()
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

  it('renders five evenly spaced x-axis labels for a longer series', () => {
    const longSeries: ComparisonAreaPoint[] = Array.from({ length: 30 }, (_, index) => ({
      id: `d${index}`,
      label: `Day ${index}`,
      current: 90,
      previous: 88,
    }))
    const { container } = render(<ComparisonAreaChart {...defaultProps} points={longSeries} />)

    const ticks = container.querySelectorAll('.recharts-xAxis .recharts-cartesian-axis-tick')
    expect(ticks.length).toBe(5)
  })

  it('fills its sized parent instead of relying on ResponsiveContainer to measure a 0-height ancestor', () => {
    const { container } = render(<ComparisonAreaChart {...defaultProps} points={points} className="h-full" />)

    const wrapper = container.querySelector('[data-slot="comparison-area-chart"]')
    expect(wrapper).toHaveClass('h-full', 'w-full')
    const chart = container.querySelector('[data-slot="chart"]')
    expect(chart).toHaveClass('h-full', 'w-full')
  })
})
