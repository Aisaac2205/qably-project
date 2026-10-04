import { expect } from 'vitest'

const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
const OUTLINE_UTILITY = /(^|\s)focus-visible:-?outline-(\d|offset-|primary)/
const INSET_FORCED_COLORS_OUTLINE = 'forced-colors:focus-visible:-outline-offset-2!'

export function focusableElements(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
}

export function expectFocusRing(element: HTMLElement, { inset = false } = {}) {
  expect(element).toHaveClass(
    'focus-visible:outline-hidden!',
    'focus-visible:ring-2',
    'focus-visible:ring-primary',
  )
  if (inset) expect(element).toHaveClass('focus-visible:ring-inset')
  if (inset || element.classList.contains('focus-visible:ring-inset')) {
    expect(element).toHaveClass(INSET_FORCED_COLORS_OUTLINE)
  }
  if (element.classList.contains('focus-visible:ring-offset-2')) {
    expect(element).toHaveClass('focus-visible:ring-offset-background')
  }
  expect(element.className).not.toMatch(OUTLINE_UTILITY)
}

export function expectEveryFocusableToCarryARing(root: ParentNode, expectedCount: number) {
  const elements = focusableElements(root)
  expect(elements).toHaveLength(expectedCount)
  for (const element of elements) expectFocusRing(element)
}
