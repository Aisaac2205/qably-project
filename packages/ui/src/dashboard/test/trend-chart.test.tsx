import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrendChart } from '../trend-chart'

const points = [
  { id: 'a', label: 'May 8', value: 78 },
  { id: 'b', label: 'May 9', value: 84 },
  { id: 'c', label: 'May 10', value: 81 },
  { id: 'd', label: 'May 11', value: 90 },
]

describe('TrendChart', () => {
  it('names the figure and describes the series without colour', () => {
    render(<TrendChart points={points} label="Pass rate over the last 4 runs" emptyLabel="No runs yet" />)

    expect(screen.getByRole('img', { name: 'Pass rate over the last 4 runs' })).toBeInTheDocument()
  })

  it('shows the empty label instead of an axis with nothing on it', () => {
    render(<TrendChart points={[]} label="Pass rate" emptyLabel="No runs yet" />)

    expect(screen.getByText('No runs yet')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('draws solid hairline gridlines, never dashed ones', () => {
    const { container } = render(<TrendChart points={points} label="Pass rate" emptyLabel="No runs yet" />)

    const gridlines = container.querySelectorAll('.recharts-cartesian-grid-horizontal line')
    expect(gridlines.length).toBeGreaterThan(0)
    for (const line of gridlines) {
      expect(line.getAttribute('stroke-dasharray')).toBeNull()
    }
  })

  it('marks only the last point, with a surface ring so it survives crossing the line', () => {
    const { container } = render(<TrendChart points={points} label="Pass rate" emptyLabel="No runs yet" />)

    const markers = container.querySelectorAll('circle[data-marker]')
    expect(markers).toHaveLength(1)
    expect(markers[0]).toHaveClass('stroke-qb-surface')
  })

  it('reveals every value through a tooltip on hover and on keyboard focus', () => {
    render(
      <TrendChart
        points={points}
        label="Pass rate"
        emptyLabel="No runs yet"
        valueFormatter={(value) => `${value}%`}
      />,
    )

    const hit = screen.getAllByRole('button')[1] as HTMLElement
    fireEvent.focus(hit)

    expect(screen.getByRole('tooltip')).toHaveTextContent('84%')
    expect(screen.getByRole('tooltip')).toHaveTextContent('May 9')
  })

  it('dismisses the tooltip on blur and on pointer leave', () => {
    render(<TrendChart points={points} label="Pass rate" emptyLabel="No runs yet" />)

    const hit = screen.getAllByRole('button')[0] as HTMLElement
    fireEvent.pointerEnter(hit)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()

    fireEvent.pointerLeave(hit)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

    fireEvent.focus(hit)
    expect(screen.getByRole('tooltip')).toBeInTheDocument()
    fireEvent.blur(hit)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('keeps the values reachable without a pointer through a table view', () => {
    render(<TrendChart points={points} label="Pass rate" emptyLabel="No runs yet" valueFormatter={(v) => `${v}%`} />)

    const table = screen.getByRole('table')
    expect(table).toHaveTextContent('May 11')
    expect(table).toHaveTextContent('90%')
  })

  it('renders the line stroke from the qb chart line token, never a hardcoded colour', () => {
    const { container } = render(<TrendChart points={points} label="Pass rate" emptyLabel="No runs yet" />)

    const curve = container.querySelector('.recharts-area-curve')
    expect(curve?.getAttribute('stroke')).toBe('var(--qb-chart-line)')
  })

  it('fills the area with a gradient of the qb chart line token, never a hardcoded colour', () => {
    const { container } = render(<TrendChart points={points} label="Pass rate" emptyLabel="No runs yet" />)

    const area = container.querySelector('.recharts-area-area')
    const fill = area?.getAttribute('fill') ?? ''
    expect(fill).toMatch(/^url\(#.+\)$/)

    const gradientId = fill.slice(5, -1)
    const stops = container.querySelectorAll(`#${CSS.escape(gradientId)} stop`)
    expect(stops.length).toBeGreaterThan(0)
    for (const stop of stops) {
      expect(stop.getAttribute('stop-color')).toBe('var(--qb-chart-line)')
    }
  })
})
