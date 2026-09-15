import * as React from 'react'

export function QablyMarkIcon({
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
      viewBox="0 0 100 100"
      className={className}
      style={{ flex: 'none', lineHeight: 1 }}
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <title>Qably</title>
      <rect x="0" y="0" width="28" height="28" rx="5" />
      <rect x="36" y="0" width="28" height="28" rx="5" />
      <rect x="72" y="0" width="28" height="28" rx="5" />
      <rect x="36" y="36" width="28" height="28" rx="5" />
      <rect x="72" y="36" width="28" height="28" rx="5" />
      <rect x="72" y="72" width="28" height="28" rx="5" />
    </svg>
  )
}
