import type { ReactNode, SVGProps } from 'react'

export interface LinearGradientProps extends SVGProps<SVGLinearGradientElement> {
  id: string
  from?: string
  to?: string
  fromOffset?: string | number
  fromOpacity?: string | number
  toOffset?: string | number
  toOpacity?: string | number
  rotate?: string | number
  vertical?: boolean
  children?: ReactNode
}

export function LinearGradient({
  children,
  id,
  from,
  to,
  x1,
  y1,
  x2,
  y2,
  fromOffset = '0%',
  fromOpacity = 1,
  toOffset = '100%',
  toOpacity = 1,
  rotate,
  transform,
  vertical = true,
  ...restProps
}: LinearGradientProps) {
  const gradientTransform = transform || (rotate ? `rotate(${rotate})` : undefined)
  const defaultX1 = vertical ? '0%' : '0%'
  const defaultY1 = vertical ? '0%' : '0%'
  const defaultX2 = vertical ? '0%' : '100%'
  const defaultY2 = vertical ? '100%' : '0%'

  return (
    <linearGradient
      id={id}
      x1={x1 ?? defaultX1}
      y1={y1 ?? defaultY1}
      x2={x2 ?? defaultX2}
      y2={y2 ?? defaultY2}
      gradientTransform={gradientTransform}
      {...restProps}
    >
      {children || (
        <>
          <stop offset={fromOffset} stopColor={from} stopOpacity={fromOpacity} />
          <stop offset={toOffset} stopColor={to} stopOpacity={toOpacity} />
        </>
      )}
    </linearGradient>
  )
}
LinearGradient.displayName = 'LinearGradient'

export interface RadialGradientProps extends SVGProps<SVGRadialGradientElement> {
  id: string
  from?: string
  to?: string
  fromOffset?: string | number
  fromOpacity?: string | number
  toOffset?: string | number
  toOpacity?: string | number
  children?: ReactNode
}

export function RadialGradient({
  children,
  id,
  from,
  to,
  fromOffset = '0%',
  fromOpacity = 1,
  toOffset = '100%',
  toOpacity = 1,
  ...restProps
}: RadialGradientProps) {
  return (
    <radialGradient id={id} {...restProps}>
      {children || (
        <>
          <stop offset={fromOffset} stopColor={from} stopOpacity={fromOpacity} />
          <stop offset={toOffset} stopColor={to} stopOpacity={toOpacity} />
        </>
      )}
    </radialGradient>
  )
}
RadialGradient.displayName = 'RadialGradient'
