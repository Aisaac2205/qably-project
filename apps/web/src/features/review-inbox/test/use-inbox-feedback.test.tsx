import { renderHook, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useInboxFeedback } from '../hooks/use-inbox-feedback'

describe('useInboxFeedback', () => {
  it('carries a link on an error toast', () => {
    const { result } = renderHook(() => useInboxFeedback())

    act(() => {
      result.current.showError('Could not publish.', {
        link: { href: '/projects/p1/suites/s1/edit?case=c1', linkLabel: 'View existing case' },
      })
    })

    expect(result.current.errors).toEqual([
      expect.objectContaining({
        message: 'Could not publish.',
        type: 'error',
        href: '/projects/p1/suites/s1/edit?case=c1',
        linkLabel: 'View existing case',
      }),
    ])
  })

  it('shows an error toast without a link when none is given', () => {
    const { result } = renderHook(() => useInboxFeedback())

    act(() => {
      result.current.showError('Could not publish.')
    })

    expect(result.current.errors).toHaveLength(1)
    expect(result.current.errors[0]).toEqual(
      expect.objectContaining({ message: 'Could not publish.', type: 'error' }),
    )
    expect(result.current.errors[0].href).toBeUndefined()
  })

  it('keeps every failure of different proposals instead of letting the last one win', () => {
    const { result } = renderHook(() => useInboxFeedback())

    act(() => {
      result.current.showError('B failed.', { key: 'b' })
    })
    act(() => {
      result.current.showError('A failed.', { key: 'a' })
    })

    expect(result.current.errors.map((error) => error.message)).toEqual(['B failed.', 'A failed.'])
  })

  it('replaces the failure of the same proposal with a fresh toast so it is announced again', () => {
    const { result } = renderHook(() => useInboxFeedback())

    act(() => {
      result.current.showError('A failed.', { key: 'a' })
    })
    const first = result.current.errors[0]
    act(() => {
      result.current.showError('A failed.', { key: 'a' })
    })

    expect(result.current.errors).toHaveLength(1)
    expect(result.current.errors[0].message).toBe('A failed.')
    expect(result.current.errors[0].id).not.toBe(first.id)
  })

  it('keeps pending failures when a later decision succeeds', () => {
    const { result } = renderHook(() => useInboxFeedback())

    act(() => {
      result.current.showError('A failed.', { key: 'a' })
    })
    act(() => {
      result.current.showSuccess('B published', { href: '/b', linkLabel: 'View case' })
    })

    expect(result.current.errors.map((error) => error.message)).toEqual(['A failed.'])
    expect(result.current.notice).toEqual(
      expect.objectContaining({ message: 'B published', type: 'success', href: '/b' }),
    )
  })

  it('gives a repeated notice a fresh id so it is announced again', () => {
    const { result } = renderHook(() => useInboxFeedback())

    act(() => {
      result.current.showInfo('Proposal rejected.')
    })
    const first = result.current.notice
    act(() => {
      result.current.showInfo('Proposal rejected.')
    })

    expect(result.current.notice?.message).toBe('Proposal rejected.')
    expect(result.current.notice?.id).not.toBe(first?.id)
  })

  it('clears the failure of one proposal and leaves the others', () => {
    const { result } = renderHook(() => useInboxFeedback())

    act(() => {
      result.current.showError('A failed.', { key: 'a' })
      result.current.showError('B failed.', { key: 'b' })
    })
    act(() => {
      result.current.clearError('a')
    })

    expect(result.current.errors.map((error) => error.message)).toEqual(['B failed.'])
  })

  it('dismisses several errors in one update and leaves the rest', () => {
    const { result } = renderHook(() => useInboxFeedback())

    act(() => {
      result.current.showError('A failed.', { key: 'a' })
      result.current.showError('B failed.', { key: 'b' })
      result.current.showError('C failed.', { key: 'c' })
    })
    const [first, second] = result.current.errors
    act(() => {
      result.current.dismissMany([first.id, second.id])
    })

    expect(result.current.errors.map((error) => error.message)).toEqual(['C failed.'])
  })

  it('keeps the same list when dismissing ids that no error has', () => {
    const { result } = renderHook(() => useInboxFeedback())

    act(() => {
      result.current.showError('A failed.', { key: 'a' })
    })
    const before = result.current.errors
    act(() => {
      result.current.dismissMany([999])
    })

    expect(result.current.errors).toBe(before)
  })

  it('dismisses one toast by its id', () => {
    const { result } = renderHook(() => useInboxFeedback())

    act(() => {
      result.current.showError('A failed.', { key: 'a' })
      result.current.showError('B failed.', { key: 'b' })
      result.current.showInfo('Showing duplicates only')
    })
    act(() => {
      result.current.dismiss(result.current.errors[0].id)
    })

    expect(result.current.errors.map((error) => error.message)).toEqual(['B failed.'])
    expect(result.current.notice?.message).toBe('Showing duplicates only')

    act(() => {
      result.current.dismiss(result.current.notice?.id ?? -1)
    })

    expect(result.current.notice).toBeNull()
  })
})
