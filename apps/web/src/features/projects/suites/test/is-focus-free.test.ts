import { afterEach, describe, expect, it } from 'vitest'
import { isFocusFree } from '@/features/projects/suites/lib/is-focus-free'

function appendInput(): HTMLInputElement {
  const input = document.createElement('input')
  document.body.append(input)

  return input
}

describe('isFocusFree', () => {
  afterEach(() => {
    document.body.replaceChildren()
  })

  it('is free when nothing but the page holds the focus', () => {
    expect(document.body).toHaveFocus()
    expect(isFocusFree()).toBe(true)
  })

  it('is not free while a control holds the focus', () => {
    const input = appendInput()

    input.focus()

    expect(isFocusFree()).toBe(false)
  })

  it('is free again when the control that held the focus is gone', () => {
    const input = appendInput()
    input.focus()

    input.remove()

    expect(isFocusFree()).toBe(true)
  })

  it('counts the elements it is told about as free', () => {
    const activator = appendInput()
    const other = appendInput()
    activator.focus()

    expect(isFocusFree(activator)).toBe(true)
    expect(isFocusFree(other)).toBe(false)
  })
})
