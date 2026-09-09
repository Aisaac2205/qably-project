import * as React from 'react'

export function AerisIcon({
  className = 'size-4',
  size,
  ...props
}: React.SVGProps<SVGSVGElement> & { size?: number | string }) {
  const width = size ?? '1em'
  const height = size ?? '1em'

  return (
    <svg
      height={height}
      width={width}
      viewBox="199 164 140 140"
      className={className}
      style={{ flex: 'none', lineHeight: 1 }}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <title>Aeris</title>
      <g transform="translate(0,500) scale(0.1,-0.1)" fill="currentColor" stroke="none">
        <path d="M3159 3059 c-45 -17 -63 -84 -34 -126 34 -48 137 -33 151 22 12 49 -22 113 -53 101 -8 -3 -11 -1 -8 4 8 12 -21 12 -56 -1z" />
        <path d="M2195 2399 c-22 -45 -53 -95 -70 -111 l-30 -30 109 4 c106 4 109 4 133 33 30 37 79 126 75 137 -1 5 5 11 13 14 8 4 15 12 15 19 0 9 -27 13 -103 14 l-103 2 -39 -82z" />
      </g>
    </svg>
  )
}
