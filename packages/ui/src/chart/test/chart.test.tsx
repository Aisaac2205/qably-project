import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LineChart, Line } from 'recharts'
import { ChartContainer, ChartTooltipContent, ChartLegendContent, type ChartConfig } from '../chart'

const config: ChartConfig = {
  current: { label: 'Actual', color: 'var(--qb-chart-line)' },
  previous: { label: 'Anterior', color: 'var(--qb-chart-compare)' },
}

const data = [
  { label: 'Lun', current: 10, previous: 8 },
  { label: 'Mar', current: 14, previous: 9 },
]

describe('ChartContainer', () => {
  it('renders its recharts child without a ResizeObserver by falling back to initialDimension', () => {
    const { container } = render(
      <ChartContainer config={config} initialDimension={{ width: 480, height: 240 }}>
        <LineChart data={data}>
          <Line dataKey="current" />
        </LineChart>
      </ChartContainer>,
    )

    expect(container.querySelector('[data-slot="chart"]')).toBeInTheDocument()
    const surface = container.querySelector('.recharts-surface')
    expect(surface).toBeInTheDocument()
    expect(surface?.getAttribute('width')).toBe('480')
    expect(surface?.getAttribute('height')).toBe('240')
  })

  it('turns every configured color into a scoped CSS variable, never inlined on the node', () => {
    const { container } = render(
      <ChartContainer config={config} initialDimension={{ width: 480, height: 240 }}>
        <LineChart data={data}>
          <Line dataKey="current" />
        </LineChart>
      </ChartContainer>,
    )

    const chartNode = container.querySelector('[data-chart]')
    const chartId = chartNode?.getAttribute('data-chart')
    const style = container.querySelector('style')

    expect(chartId).toBeTruthy()
    expect(style?.innerHTML).toContain(`[data-chart=${chartId}]`)
    expect(style?.innerHTML).toContain('--color-current: var(--qb-chart-line);')
    expect(style?.innerHTML).toContain('--color-previous: var(--qb-chart-compare);')
  })

  it('skips the style tag entirely when nothing in the config carries a color', () => {
    const { container } = render(
      <ChartContainer config={{ current: { label: 'Actual' } }} initialDimension={{ width: 480, height: 240 }}>
        <LineChart data={data}>
          <Line dataKey="current" />
        </LineChart>
      </ChartContainer>,
    )

    expect(container.querySelector('style')).not.toBeInTheDocument()
  })
})

describe('ChartTooltipContent', () => {
  const payload = [
    {
      dataKey: 'current',
      name: 'current',
      value: 14,
      color: 'var(--qb-chart-line)',
      payload: {},
      graphicalItemId: 'current',
    },
  ]

  it('renders the resolved category label and the series label and value when active', () => {
    render(
      <ChartContainer config={config} initialDimension={{ width: 480, height: 240 }}>
        <div>
          <ChartTooltipContent active payload={payload} label="Lun" />
        </div>
      </ChartContainer>,
    )

    expect(screen.getByText('Lun')).toBeInTheDocument()
    expect(screen.getByText('Actual')).toBeInTheDocument()
    expect(screen.getByText('14')).toBeInTheDocument()
  })

  it('renders nothing when inactive', () => {
    const { container } = render(
      <ChartContainer config={config} initialDimension={{ width: 480, height: 240 }}>
        <div>
          <ChartTooltipContent active={false} payload={payload} label="current" />
        </div>
      </ChartContainer>,
    )

    expect(container.querySelector('.grid')).not.toBeInTheDocument()
  })

  it('defers to a caller-supplied formatter instead of the default value rendering', () => {
    render(
      <ChartContainer config={config} initialDimension={{ width: 480, height: 240 }}>
        <div>
          <ChartTooltipContent
            active
            payload={payload}
            label="current"
            formatter={(value) => <span key="fmt">{`${value}%`}</span>}
          />
        </div>
      </ChartContainer>,
    )

    expect(screen.getByText('14%')).toBeInTheDocument()
  })
})

describe('ChartLegendContent', () => {
  it('renders one entry per legend payload item, labelled from the config', () => {
    const legendPayload = [
      { value: 'current', dataKey: 'current', type: 'line' as const, color: 'var(--qb-chart-line)' },
      { value: 'previous', dataKey: 'previous', type: 'line' as const, color: 'var(--qb-chart-compare)' },
    ]

    render(
      <ChartContainer config={config} initialDimension={{ width: 480, height: 240 }}>
        <div>
          <ChartLegendContent payload={legendPayload} />
        </div>
      </ChartContainer>,
    )

    expect(screen.getByText('Actual')).toBeInTheDocument()
    expect(screen.getByText('Anterior')).toBeInTheDocument()
  })

  it('renders nothing when the payload is empty', () => {
    const { container } = render(
      <ChartContainer config={config} initialDimension={{ width: 480, height: 240 }}>
        <div>
          <ChartLegendContent payload={[]} />
        </div>
      </ChartContainer>,
    )

    expect(container.querySelector('.flex.items-center.justify-center')).not.toBeInTheDocument()
  })
})
