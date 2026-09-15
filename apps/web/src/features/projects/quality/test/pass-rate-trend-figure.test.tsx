import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  PassRateTrendFigure,
  type TrendPoint,
} from '@/features/projects/quality/components/pass-rate-trend-figure'

const points: TrendPoint[] = [
  { id: 'run-1', date: '2026-06-14T10:00:00Z', passRate: 60 },
  { id: 'run-2', date: '2026-06-15T10:00:00Z', passRate: 80 },
  { id: 'run-3', date: '2026-06-16T10:00:00Z', passRate: 95 },
]

describe('PassRateTrendFigure', () => {
  it('renders a smoothed line and a gradient-filled area under it', () => {
    render(<PassRateTrendFigure points={points} />)

    const figure = screen.getByRole('img').closest('figure') as HTMLElement
    expect(figure).not.toBeNull()

    const svg = within(figure).getByRole('img')
    const linePath = svg.querySelector('path.quality-trend-line')
    expect(linePath).not.toBeNull()
    expect(linePath?.getAttribute('d')).toMatch(/^M .* C /)

    const areaPath = svg.querySelector('path.quality-trend-area')
    expect(areaPath).not.toBeNull()
    const fill = areaPath?.getAttribute('fill') ?? ''
    expect(fill).toMatch(/^url\(#.+\)$/)

    const gradient = svg.querySelector('linearGradient')
    expect(gradient).not.toBeNull()
    expect(gradient?.querySelectorAll('stop').length).toBe(2)
  })

  it('still exposes the accessible data table fallback with every point', () => {
    render(<PassRateTrendFigure points={points} />)

    const figure = screen.getByRole('img').closest('figure') as HTMLElement
    const table = within(figure).getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(points.length + 1)
  })

  it('colors the line and area with the fail tone when the average pass rate is zero', () => {
    render(
      <PassRateTrendFigure
        points={[
          { id: 'run-1', date: '2026-06-14T10:00:00Z', passRate: 0 },
          { id: 'run-2', date: '2026-06-15T10:00:00Z', passRate: 0 },
        ]}
      />,
    )

    const figure = screen.getByRole('img').closest('figure') as HTMLElement
    const svg = within(figure).getByRole('img')
    const coloredGroup = svg.querySelector('.text-fail')
    expect(coloredGroup).not.toBeNull()
  })
})
