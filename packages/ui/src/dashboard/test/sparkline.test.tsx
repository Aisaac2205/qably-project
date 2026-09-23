import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Sparkline } from '../sparkline'

describe('Sparkline', () => {
  it('is an image with an accessible name, never a decorative squiggle', () => {
    render(<Sparkline values={[10, 40, 30, 60]} label="Pass rate over the last 4 runs" />)

    expect(screen.getByRole('img', { name: 'Pass rate over the last 4 runs' })).toBeInTheDocument()
  })

  it('plots one point per value with no end dot, per the mockup', () => {
    const { container } = render(<Sparkline values={[10, 40, 30, 60]} label="trend" />)

    const path = container.querySelector('.recharts-area-curve')
    expect(path).toBeInTheDocument()
    expect(container.querySelectorAll('circle')).toHaveLength(0)
  })

  it('defaults to a 96x44 box per the mockup', () => {
    const { container } = render(<Sparkline values={[10, 40, 30, 60]} label="trend" />)

    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '96')
    expect(svg).toHaveAttribute('height', '44')
  })

  it('uses a thin 1.6px stroke and a soft area fill, per the mockup', () => {
    const { container } = render(<Sparkline values={[10, 40, 30, 60]} label="trend" />)

    const path = container.querySelector('.recharts-area-curve')
    expect(path).toHaveAttribute('stroke-width', '1.6')
    const stop = container.querySelector('linearGradient stop')
    expect(stop).toHaveAttribute('stop-opacity', '0.08')
  })

  it('renders an accessible dot for a single value instead of a silent blank', () => {
    render(<Sparkline values={[42]} label="single" />)

    expect(screen.getByRole('img', { name: 'single' })).toBeInTheDocument()
  })

  it('renders no visual and an accessible empty-state name for an empty series', () => {
    render(<Sparkline values={[]} label="trend" emptyLabel="No data" />)

    const image = screen.getByRole('img', { name: 'No data' })
    expect(image).toBeInTheDocument()
    expect(image.querySelector('.recharts-surface')).not.toBeInTheDocument()
  })

  it('renders no visual and an accessible empty-state name when every value is null', () => {
    render(<Sparkline values={[null, null, null]} label="trend" emptyLabel="No data" />)

    const image = screen.getByRole('img', { name: 'No data' })
    expect(image).toBeInTheDocument()
    expect(image.querySelector('.recharts-surface')).not.toBeInTheDocument()
  })

  it('falls back to the label as the accessible name when no emptyLabel is given', () => {
    render(<Sparkline values={[null, null]} label="trend" />)

    expect(screen.getByRole('img', { name: 'trend' })).toBeInTheDocument()
  })

  it('connects across a null day so the line stays continuous, per the mockup', () => {
    const { container } = render(<Sparkline values={[10, null, 30, 60]} label="trend with a gap" />)

    const path = container.querySelector('.recharts-area-curve')
    const commands = (path?.getAttribute('d') ?? '').match(/M/g) ?? []
    expect(commands.length).toBe(1)
  })

  it('renders no end-of-line marker when the series ends with a gap', () => {
    const { container } = render(<Sparkline values={[10, 40, 30, null]} label="trend ending in a gap" />)

    expect(container.querySelectorAll('circle')).toHaveLength(0)
  })

  it('colours the line by tone through the scoped chart variable', () => {
    const { container } = render(<Sparkline values={[10, 20, 30]} label="trend" tone="fail" />)

    const path = container.querySelector('.recharts-area-curve')
    expect(path).toHaveAttribute('stroke', 'var(--color-value)')
    const style = container.querySelector('style')
    expect(style?.innerHTML).toContain('--color-value: var(--qb-chart-fail);')
  })

  it('defaults the line tone to primary when no tone is given', () => {
    const { container } = render(<Sparkline values={[10, 20, 30]} label="trend" />)

    const style = container.querySelector('style')
    expect(style?.innerHTML).toContain('--color-value: var(--qb-chart-line);')
  })

  it('maps the muted tone to the comparison chart token', () => {
    const { container } = render(<Sparkline values={[10, 20, 30]} label="trend" tone="muted" />)

    const style = container.querySelector('style')
    expect(style?.innerHTML).toContain('--color-value: var(--qb-chart-compare);')
  })

  it('maps the warn tone to the warn chart token', () => {
    const { container } = render(<Sparkline values={[10, 20, 30]} label="trend" tone="warn" />)

    const style = container.querySelector('style')
    expect(style?.innerHTML).toContain('--color-value: var(--qb-chart-warn);')
  })
})
