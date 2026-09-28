import type { CSSProperties, ReactNode, SVGProps } from 'react'

export interface GridLineItem {
  index: number
  from: { x: number; y: number }
  to: { x: number; y: number }
}

export interface GridRowsProps extends Omit<SVGProps<SVGLineElement>, 'children' | 'scale'> {
  scale: any
  width: number
  top?: number
  left?: number
  numTicks?: number
  tickValues?: any[]
  offset?: number
  lineStyle?: CSSProperties
  children?: (args: { lines: GridLineItem[] }) => ReactNode
}

function getScaleTicks(scale: any, numTicks = 10) {
  if (scale && typeof scale.ticks === 'function') return scale.ticks(numTicks)
  if (scale && typeof scale.domain === 'function') return scale.domain()
  return []
}

function getScaleBandwidth(scale: any) {
  return scale && typeof scale.bandwidth === 'function' ? scale.bandwidth() : 0
}

export function GridRows({
  top = 0,
  left = 0,
  scale,
  width,
  stroke = '#eaf0f6',
  strokeWidth = 1,
  strokeDasharray,
  className,
  children,
  numTicks = 10,
  lineStyle,
  offset = 0,
  tickValues,
  ...restProps
}: GridRowsProps) {
  const ticks = tickValues ?? getScaleTicks(scale, numTicks)
  const scaleOffset = offset + getScaleBandwidth(scale) / 2

  const tickLines: GridLineItem[] = ticks.map((d: any, index: number) => {
    const y = (Number(scale(d)) || 0) + scaleOffset
    return {
      index,
      from: { x: 0, y },
      to: { x: width, y },
    }
  })

  if (children) {
    return <g transform={`translate(${left}, ${top})`} className={className}>{children({ lines: tickLines })}</g>
  }

  return (
    <g transform={`translate(${left}, ${top})`} className={className || 'visx-rows'}>
      {tickLines.map(({ from, to, index }) => (
        <line
          key={`row-line-${index}`}
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          style={lineStyle}
          {...restProps}
        />
      ))}
    </g>
  )
}

export interface GridColumnsProps extends Omit<SVGProps<SVGLineElement>, 'children' | 'scale'> {
  scale: any
  height: number
  top?: number
  left?: number
  numTicks?: number
  tickValues?: any[]
  offset?: number
  lineStyle?: CSSProperties
  children?: (args: { lines: GridLineItem[] }) => ReactNode
}

export function GridColumns({
  top = 0,
  left = 0,
  scale,
  height,
  stroke = '#eaf0f6',
  strokeWidth = 1,
  strokeDasharray,
  className,
  children,
  numTicks = 10,
  lineStyle,
  offset = 0,
  tickValues,
  ...restProps
}: GridColumnsProps) {
  const ticks = tickValues ?? getScaleTicks(scale, numTicks)
  const scaleOffset = offset + getScaleBandwidth(scale) / 2

  const tickLines: GridLineItem[] = ticks.map((d: any, index: number) => {
    const x = (Number(scale(d)) || 0) + scaleOffset
    return {
      index,
      from: { x, y: 0 },
      to: { x, y: height },
    }
  })

  if (children) {
    return <g transform={`translate(${left}, ${top})`} className={className}>{children({ lines: tickLines })}</g>
  }

  return (
    <g transform={`translate(${left}, ${top})`} className={className || 'visx-columns'}>
      {tickLines.map(({ from, to, index }) => (
        <line
          key={`col-line-${index}`}
          x1={from.x}
          y1={from.y}
          x2={to.x}
          y2={to.y}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          style={lineStyle}
          {...restProps}
        />
      ))}
    </g>
  )
}
