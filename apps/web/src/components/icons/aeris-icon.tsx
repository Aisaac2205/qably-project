import * as React from 'react'

export function AerisIcon({
  className = 'size-4',
  size,
  style,
  ...props
}: Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  size?: number | string
}) {
  return (
    <img
      src="/aeris.png"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className}
      style={{
        flex: 'none',
        objectFit: 'contain',
        ...(size === undefined ? {} : { width: size, height: size }),
        ...style,
      }}
      {...props}
    />
  )
}
