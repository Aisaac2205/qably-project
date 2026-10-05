'use client'

import { useEffect, useRef, type RefObject } from 'react'
import { usePathname } from 'next/navigation'
import { createScrollRestoration, type ScrollRestoration } from '@/lib/scroll-restoration'

export function useScrollRestoration(containerRef: RefObject<HTMLElement | null>) {
  const pathname = usePathname()
  const restoration = useRef<ScrollRestoration | null>(null)

  useEffect(() => {
    const container = containerRef.current

    if (container === null) return

    const created = createScrollRestoration(container, window.location.pathname)

    restoration.current = created

    return () => {
      created.destroy()
      restoration.current = null
    }
  }, [containerRef])

  useEffect(() => {
    restoration.current?.commit(pathname)
  }, [pathname])
}
