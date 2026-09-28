import { area as d3Area, line as d3Line, arc as d3Arc } from 'd3-shape'
import type { CurveFactory } from 'd3-shape'
import type { SVGProps, Ref, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface ArcConfig {
  innerRadius?: number | ((...args: any[]) => number)
  outerRadius?: number | ((...args: any[]) => number)
  cornerRadius?: number | ((...args: any[]) => number)
  startAngle?: number | ((...args: any[]) => number)
  endAngle?: number | ((...args: any[]) => number)
  padAngle?: number | ((...args: any[]) => number)
  padRadius?: number | ((...args: any[]) => number)
}

export function arc<Datum = unknown>(config: ArcConfig = {}) {
  const path = d3Arc<any, Datum>()
  if (config.innerRadius != null) path.innerRadius(config.innerRadius as any)
  if (config.outerRadius != null) path.outerRadius(config.outerRadius as any)
  if (config.cornerRadius != null) path.cornerRadius(config.cornerRadius as any)
  if (config.startAngle != null) path.startAngle(config.startAngle as any)
  if (config.endAngle != null) path.endAngle(config.endAngle as any)
  if (config.padAngle != null) path.padAngle(config.padAngle as any)
  if (config.padRadius != null) path.padRadius(config.padRadius as any)
  return path
}

export interface LinePathProps<Datum> extends Omit<SVGProps<SVGPathElement>, 'children' | 'x' | 'y'> {
  data?: Datum[]
  x?: number | ((d: Datum, index: number, data: Datum[]) => number)
  y?: number | ((d: Datum, index: number, data: Datum[]) => number)
  defined?: (d: Datum, index: number, data: Datum[]) => boolean
  curve?: CurveFactory
  innerRef?: Ref<SVGPathElement>
  children?: (args: { path: any }) => ReactNode
}

export function LinePath<Datum>({
  children,
  data = [],
  x,
  y,
  fill = 'transparent',
  className,
  curve,
  innerRef,
  defined = () => true,
  ...restProps
}: LinePathProps<Datum>) {
  const path = d3Line<Datum>()
  if (x != null) path.x(typeof x === 'function' ? x : () => x)
  if (y != null) path.y(typeof y === 'function' ? y : () => y)
  if (defined) path.defined(defined)
  if (curve) path.curve(curve)

  if (children) {
    return <>{children({ path })}</>
  }

  return (
    <path
      ref={innerRef}
      className={cn('visx-linepath', className)}
      d={path(data) || ''}
      fill={fill}
      strokeLinecap="round"
      {...restProps}
    />
  )
}

export interface AreaClosedProps<Datum>
  extends Omit<SVGProps<SVGPathElement>, 'children' | 'x' | 'x0' | 'x1' | 'y' | 'y0' | 'y1'> {
  data?: Datum[]
  x?: number | ((d: Datum, index: number, data: Datum[]) => number)
  x0?: number | ((d: Datum, index: number, data: Datum[]) => number)
  x1?: number | ((d: Datum, index: number, data: Datum[]) => number)
  y?: number | ((d: Datum, index: number, data: Datum[]) => number)
  y0?: number | ((d: Datum, index: number, data: Datum[]) => number)
  y1?: number | ((d: Datum, index: number, data: Datum[]) => number)
  yScale: { range: () => number[] } | any
  defined?: (d: Datum, index: number, data: Datum[]) => boolean
  curve?: CurveFactory
  innerRef?: Ref<SVGPathElement>
  children?: (args: { path: any }) => ReactNode
}

export function AreaClosed<Datum>({
  x,
  x0,
  x1,
  y,
  y0,
  y1,
  yScale,
  data = [],
  defined = () => true,
  className,
  curve,
  innerRef,
  children,
  ...restProps
}: AreaClosedProps<Datum>) {
  const path = d3Area<Datum>()
  if (x != null) path.x(typeof x === 'function' ? x : () => x)
  if (x0 != null) path.x0(typeof x0 === 'function' ? x0 : () => x0)
  if (x1 != null) path.x1(typeof x1 === 'function' ? x1 : () => x1)

  if (y0 == null) {
    if (yScale && typeof yScale.range === 'function') {
      path.y0(yScale.range()[0])
    }
  } else {
    path.y0(typeof y0 === 'function' ? y0 : () => y0)
  }

  if (y != null && y1 == null) path.y1(typeof y === 'function' ? y : () => y)
  if (y1 != null && y == null) path.y1(typeof y1 === 'function' ? y1 : () => y1)
  if (y != null && y1 != null) path.y1(typeof y1 === 'function' ? y1 : () => y1)

  if (defined) path.defined(defined)
  if (curve) path.curve(curve)

  if (children) {
    return <>{children({ path })}</>
  }

  return (
    <path
      ref={innerRef}
      className={cn('visx-area-closed', className)}
      d={path(data) || ''}
      {...restProps}
    />
  )
}
