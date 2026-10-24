import * as React from 'react'

// The mark is a square with the glyph at ~85% of it, the same optical box as the
// Phosphor icons it sits next to, so a size that suits them suits it too. Bump
// the version whenever the file is replaced, to skip stale caches.
const AERIS_MARK_SRC = '/aeris.png?v=2'

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
      src={AERIS_MARK_SRC}
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
