import { afterEach, describe, expect, it } from 'vitest'
import { isFocusHeldWithin } from '@/features/projects/suites/lib/is-focus-held-within'

function appendButton(parent: Element): HTMLButtonElement {
  const button = document.createElement('button')
  parent.append(button)

  return button
}

function appendRegion(): { current: HTMLDivElement } {
  const region = document.createElement('div')
  document.body.append(region)

  return { current: region }
}

describe('isFocusHeldWithin', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('is held while a control inside the region has the focus', () => {
    const region = appendRegion()
    appendButton(region.current).focus()

    expect(isFocusHeldWithin(region)).toBe(true)
  })

  it('is held by a control nested deeper in the region', () => {
    const region = appendRegion()
    const group = document.createElement('div')
    region.current.append(group)
    appendButton(group).focus()

    expect(isFocusHeldWithin(region)).toBe(true)
  })

  it('is not held while a control outside the region has the focus', () => {
    const region = appendRegion()
    appendButton(region.current)
    appendButton(document.body).focus()

    expect(isFocusHeldWithin(region)).toBe(false)
  })

  it('is not held while only the page has the focus', () => {
    const region = appendRegion()
    appendButton(region.current)

    expect(document.body).toHaveFocus()
    expect(isFocusHeldWithin(region)).toBe(false)
  })

  it('is not held once the control that had the focus left the page', () => {
    const region = appendRegion()
    const button = appendButton(region.current)
    button.focus()
    expect(isFocusHeldWithin(region)).toBe(true)

    button.remove()

    expect(isFocusHeldWithin(region)).toBe(false)
  })

  it('is not held when the region is not mounted', () => {
    appendButton(document.body).focus()

    expect(isFocusHeldWithin({ current: null })).toBe(false)
  })
})
