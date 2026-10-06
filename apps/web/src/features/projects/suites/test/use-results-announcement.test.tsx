import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useI18nStore } from '@/lib/i18n/store'
import { useResultsAnnouncement } from '@/features/projects/suites/hooks/use-results-announcement'

interface Input {
  resultsKey: string
  rowCount: number
  isSettled: boolean
  isFetchingMore: boolean
}

const SETTLED: Input = {
  resultsKey: 'recent',
  rowCount: 50,
  isSettled: true,
  isFetchingMore: false,
}

function renderAnnouncement(initial: Input = SETTLED) {
  return renderHook((props: Input) => useResultsAnnouncement(props), { initialProps: initial })
}

function loadingMore(from: Input, rowCount = from.rowCount): Input {
  return { ...from, rowCount, isSettled: false, isFetchingMore: true }
}

function settledWith(from: Input, patch: Partial<Input>): Input {
  return { ...from, isSettled: true, isFetchingMore: false, ...patch }
}

describe('useResultsAnnouncement', () => {
  afterEach(() => {
    useI18nStore.setState({ locale: 'en' })
  })

  describe('on the first render', () => {
    it.each([0, 1, 50])('says nothing with %s rows already loaded', (rowCount) => {
      const { result } = renderAnnouncement({ ...SETTLED, rowCount })

      expect(result.current).toBe('')
    })

    it('says nothing while the first page is loading, nor when it lands', () => {
      const loading: Input = { ...SETTLED, rowCount: 0, isSettled: false }
      const { result, rerender } = renderAnnouncement(loading)
      expect(result.current).toBe('')

      rerender(settledWith(loading, { rowCount: 50 }))

      expect(result.current).toBe('')
    })
  })

  describe('after a page of more suites is loaded', () => {
    it('counts the suites that arrived', () => {
      const { result, rerender } = renderAnnouncement()

      rerender(loadingMore(SETTLED))
      rerender(settledWith(SETTLED, { rowCount: 100 }))

      expect(result.current).toBe('50 more suites loaded')
    })

    it('uses the singular for a single suite', () => {
      const { result, rerender } = renderAnnouncement()

      rerender(loadingMore(SETTLED))
      rerender(settledWith(SETTLED, { rowCount: 51 }))

      expect(result.current).toBe('1 more suite loaded')
    })

    it('counts only the new suites on each later page', () => {
      const { result, rerender } = renderAnnouncement()
      rerender(loadingMore(SETTLED))
      rerender(settledWith(SETTLED, { rowCount: 100 }))

      rerender(loadingMore(SETTLED, 100))
      rerender(settledWith(SETTLED, { rowCount: 120 }))

      expect(result.current).toBe('20 more suites loaded')
    })

    it('says nothing while the page is in flight', () => {
      const { result, rerender } = renderAnnouncement()

      rerender(loadingMore(SETTLED))

      expect(result.current).toBe('')
    })

    it('clears the previous message when the next page starts, so the same text can be read again', () => {
      const { result, rerender } = renderAnnouncement()
      rerender(loadingMore(SETTLED))
      rerender(settledWith(SETTLED, { rowCount: 100 }))
      expect(result.current).toBe('50 more suites loaded')

      rerender(loadingMore(SETTLED, 100))
      expect(result.current).toBe('')

      rerender(settledWith(SETTLED, { rowCount: 150 }))
      expect(result.current).toBe('50 more suites loaded')
    })

    it('says nothing when the page fails or brings no new row', () => {
      const { result, rerender } = renderAnnouncement()

      rerender(loadingMore(SETTLED))
      rerender(settledWith(SETTLED, { rowCount: 50 }))

      expect(result.current).toBe('')
    })

    it('is spoken in Spanish with the right plural', () => {
      useI18nStore.setState({ locale: 'es' })
      const { result, rerender } = renderAnnouncement()

      rerender(loadingMore(SETTLED))
      rerender(settledWith(SETTLED, { rowCount: 100 }))
      expect(result.current).toBe('Se cargaron 50 suites más')

      rerender(loadingMore(SETTLED, 100))
      rerender(settledWith(SETTLED, { rowCount: 101 }))
      expect(result.current).toBe('Se cargó 1 suite más')
    })
  })

  describe('after the search, a filter or the order settles', () => {
    it.each([
      [3, '3 suites shown'],
      [1, '1 suite shown'],
      [0, '0 suites shown'],
    ])('announces %s rows as "%s"', (rowCount, message) => {
      const { result, rerender } = renderAnnouncement()

      rerender(settledWith(SETTLED, { resultsKey: 'name', rowCount }))

      expect(result.current).toBe(message)
    })

    it('says nothing while the new results are still a placeholder', () => {
      const { result, rerender } = renderAnnouncement()

      rerender({ ...SETTLED, resultsKey: 'recent+abc', isSettled: false })

      expect(result.current).toBe('')
    })

    it('clears the previous message as soon as the change starts', () => {
      const { result, rerender } = renderAnnouncement()
      rerender(settledWith(SETTLED, { resultsKey: 'name', rowCount: 3 }))
      expect(result.current).toBe('3 suites shown')

      rerender({ ...SETTLED, resultsKey: 'name+abc', rowCount: 3, isSettled: false })

      expect(result.current).toBe('')
    })

    it('announces the rows of the new results once they settle', () => {
      const { result, rerender } = renderAnnouncement()
      rerender({ ...SETTLED, resultsKey: 'recent+abc', isSettled: false })

      rerender(settledWith(SETTLED, { resultsKey: 'recent+abc', rowCount: 4 }))

      expect(result.current).toBe('4 suites shown')
    })

    it('announces a page that was cached, with no placeholder in between', () => {
      const { result, rerender } = renderAnnouncement()

      rerender(settledWith(SETTLED, { resultsKey: 'cases', rowCount: 7 }))

      expect(result.current).toBe('7 suites shown')
    })

    it('reads a change that lands while a next page was in flight as a new result, not as more suites', () => {
      const { result, rerender } = renderAnnouncement()
      rerender(loadingMore(SETTLED))

      rerender(settledWith(SETTLED, { resultsKey: 'recent+abc', rowCount: 2 }))

      expect(result.current).toBe('2 suites shown')
    })

    it('says nothing when the same results settle again with other rows, as a refresh does', () => {
      const { result, rerender } = renderAnnouncement()

      rerender(settledWith(SETTLED, { rowCount: 52 }))

      expect(result.current).toBe('')
    })

    it('is spoken in Spanish with the right plural', () => {
      useI18nStore.setState({ locale: 'es' })
      const { result, rerender } = renderAnnouncement()

      rerender(settledWith(SETTLED, { resultsKey: 'name', rowCount: 3 }))
      expect(result.current).toBe('3 suites mostradas')

      rerender(settledWith(SETTLED, { resultsKey: 'cases', rowCount: 1 }))
      expect(result.current).toBe('1 suite mostrada')

      rerender(settledWith(SETTLED, { resultsKey: 'pass-rate', rowCount: 0 }))
      expect(result.current).toBe('0 suites mostradas')
    })
  })
})
