import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useKeyboardShortcuts } from '@/features/runs/hooks/use-keyboard-shortcuts'

describe('useKeyboardShortcuts', () => {
  it('calls handler when registered key is pressed', () => {
    const onP = vi.fn()
    renderHook(() => useKeyboardShortcuts({ p: onP }))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }))
    })

    expect(onP).toHaveBeenCalledTimes(1)
  })

  it('does not call handler for unregistered key', () => {
    const onP = vi.fn()
    renderHook(() => useKeyboardShortcuts({ p: onP }))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }))
    })

    expect(onP).not.toHaveBeenCalled()
  })

  it('ignores keydown when focus is in INPUT', () => {
    const onP = vi.fn()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    renderHook(() => useKeyboardShortcuts({ p: onP }))

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }))
    })

    expect(onP).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('ignores keydown when focus is in TEXTAREA', () => {
    const onP = vi.fn()
    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    renderHook(() => useKeyboardShortcuts({ p: onP }))

    act(() => {
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }))
    })

    expect(onP).not.toHaveBeenCalled()
    document.body.removeChild(textarea)
  })

  it('ignores keydown when focus is in SELECT', () => {
    const onP = vi.fn()
    const select = document.createElement('select')
    document.body.appendChild(select)
    select.focus()

    renderHook(() => useKeyboardShortcuts({ p: onP }))

    act(() => {
      select.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }))
    })

    expect(onP).not.toHaveBeenCalled()
    document.body.removeChild(select)
  })

  it('ignores keydown when focused element is contenteditable', () => {
    const onP = vi.fn()
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    document.body.appendChild(div)
    div.focus()

    renderHook(() => useKeyboardShortcuts({ p: onP }))

    act(() => {
      div.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }))
    })

    expect(onP).not.toHaveBeenCalled()
    document.body.removeChild(div)
  })

  it('calls preventDefault when handler is registered', () => {
    const onP = vi.fn()
    renderHook(() => useKeyboardShortcuts({ p: onP }))

    const event = new KeyboardEvent('keydown', { key: 'p', bubbles: true, cancelable: true })
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault')

    act(() => {
      window.dispatchEvent(event)
    })

    expect(preventDefaultSpy).toHaveBeenCalled()
  })

  it('honours enabled option — does nothing when disabled', () => {
    const onP = vi.fn()
    renderHook(() => useKeyboardShortcuts({ p: onP }, { enabled: false }))

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }))
    })

    expect(onP).not.toHaveBeenCalled()
  })

  it('cleans up listener on unmount', () => {
    const onP = vi.fn()
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useKeyboardShortcuts({ p: onP }))

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function))
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function))

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
