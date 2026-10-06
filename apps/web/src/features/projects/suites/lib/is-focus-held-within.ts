import type { RefObject } from 'react'

export function isFocusHeldWithin(region: RefObject<Element | null>): boolean {
  const active = document.activeElement
  const container = region.current

  return (
    container !== null &&
    active !== null &&
    active !== document.body &&
    active.isConnected &&
    container.contains(active)
  )
}
