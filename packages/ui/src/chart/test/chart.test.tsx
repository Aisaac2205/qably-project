import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps the accessible role and label mounted when a real ResizeObserver reports a zero-size box', () => {
    class ZeroSizeResizeObserver {
      private readonly callback: ResizeObserverCallback

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
      }

      observe() {
        this.callback(
          [{ contentRect: { width: 0, height: 0 } } as ResizeObserverEntry],
          this as unknown as ResizeObserver,
        )
      }

      unobserve() {}
      disconnect() {}
    }

    vi.stubGlobal('ResizeObserver', ZeroSizeResizeObserver)

    const { container } = render(
      <ChartContainer
        config={config}
        initialDimension={{ width: 480, height: 240 }}
        role="img"
        aria-label="Weekly trend"
      >
        <LineChart data={data}>
          <Line dataKey="current" />
        </LineChart>
      </ChartContainer>,
    )

    expect(screen.getByRole('img', { name: 'Weekly trend' })).toBeInTheDocument()
    expect(container.querySelector('.recharts-surface')).not.toBeInTheDocument()
  })

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
    expect(style?.innerHTML).toContain(`[data-chart="${chartId}"]`)
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

  it('never interpolates a config key that would break out of the CSS declaration block', () => {
    const unsafeConfig: ChartConfig = {
      'x;}body{display:none}': { color: 'var(--qb-chart-line)' },
      previous: { label: 'Anterior', color: 'var(--qb-chart-compare)' },
    }

    const { container } = render(
      <ChartContainer config={unsafeConfig} initialDimension={{ width: 480, height: 240 }}>
        <LineChart data={data}>
          <Line dataKey="current" />
        </LineChart>
      </ChartContainer>,
    )

    const style = container.querySelector('style')
    expect(style?.innerHTML).not.toContain('body{display:none}')
    expect(style?.innerHTML).toContain('--color-previous: var(--qb-chart-compare);')
  })

  it('never interpolates a config color that would break out of the CSS declaration block', () => {
    const unsafeConfig: ChartConfig = {
      current: { color: 'red;} *{x:y' as NonNullable<ChartConfig[string]['color']> },
      previous: { label: 'Anterior', color: 'var(--qb-chart-compare)' },
    }

    const { container } = render(
      <ChartContainer config={unsafeConfig} initialDimension={{ width: 480, height: 240 }}>
        <LineChart data={data}>
          <Line dataKey="current" />
        </LineChart>
      </ChartContainer>,
    )

    const style = container.querySelector('style')
    expect(style?.innerHTML).not.toContain('red;')
    expect(style?.innerHTML).not.toContain('*{x:y')
    expect(style?.innerHTML).toContain('--color-previous: var(--qb-chart-compare);')
  })

  it('sanitises a caller-supplied id so the style selector always matches the data-chart attribute', () => {
    const { container } = render(
      <ChartContainer id="weekly:trend" config={config} initialDimension={{ width: 480, height: 240 }}>
        <LineChart data={data}>
          <Line dataKey="current" />
        </LineChart>
      </ChartContainer>,
    )

    const chartNode = container.querySelector('[data-chart]')
    const chartId = chartNode?.getAttribute('data-chart') ?? ''
    const style = container.querySelector('style')

    expect(chartId).not.toContain(':')
    expect(style?.innerHTML).toContain(`[data-chart="${chartId}"]`)
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
