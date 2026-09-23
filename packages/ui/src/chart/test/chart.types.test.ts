import { describe, expectTypeOf, it } from 'vitest'
import type { ChartConfig } from '../chart'

type ConfiguredColor = NonNullable<ChartConfig[string]['color']>

describe('ChartConfig color type', () => {
  it('accepts a qb chart css var', () => {
    expectTypeOf<'var(--qb-chart-line)'>().toMatchTypeOf<ConfiguredColor>()
    expectTypeOf<'var(--qb-chart-compare)'>().toMatchTypeOf<ConfiguredColor>()
  })

  it('rejects a raw hardcoded color at compile time', () => {
    expectTypeOf<'#ffffff'>().not.toMatchTypeOf<ConfiguredColor>()
    expectTypeOf<'oklch(0.62 0.16 145)'>().not.toMatchTypeOf<ConfiguredColor>()
    expectTypeOf<'red'>().not.toMatchTypeOf<ConfiguredColor>()
  })
})
