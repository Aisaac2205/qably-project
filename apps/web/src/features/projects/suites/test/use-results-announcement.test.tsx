import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useI18nStore } from '@/lib/i18n/store'
import { useResultsAnnouncement } from '@/features/projects/suites/hooks/use-results-announcement'

interface Input {
  resultsKey: string
  rowCount: number
  pageCount: number
  isSettled: boolean
  hasFailed: boolean
}

const SETTLED: Input = {
  resultsKey: 'recent',
  rowCount: 50,
  pageCount: 1,
  isSettled: true,
  hasFailed: false,
}

function renderAnnouncement(initial: Input = SETTLED) {
  return renderHook((props: Input) => useResultsAnnouncement(props).message, {
    initialProps: initial,
  })
}

function renderEvents(initial: Input = SETTLED) {
  return renderHook((props: Input) => useResultsAnnouncement(props), { initialProps: initial })
}

function pending(from: Input, rowCount = from.rowCount): Input {
  return { ...from, rowCount, isSettled: false }
}

function settledWith(from: Input, patch: Partial<Input>): Input {
  return { ...from, isSettled: true, ...patch }
}

describe('useResultsAnnouncement', () => {
  afterEach(() => {
    act(() => {
      useI18nStore.setState({ locale: 'en' })
    })
  })

  describe('on the first render', () => {
    it.each([0, 1, 50])('says nothing with %s rows already loaded', (rowCount) => {
      const { result } = renderAnnouncement({ ...SETTLED, rowCount })

      expect(result.current).toBe('')
    })

    it('says nothing while the first page is loading, nor when it lands', () => {
      const loading: Input = { ...SETTLED, rowCount: 0, pageCount: 0, isSettled: false }
      const { result, rerender } = renderAnnouncement(loading)
      expect(result.current).toBe('')

      rerender(settledWith(loading, { rowCount: 50, pageCount: 1 }))

      expect(result.current).toBe('')
    })
  })

  describe('the event behind each message', () => {
    it('gives every announcement its own event, even when the text is the same as before', () => {
      const { result, rerender } = renderEvents()

      rerender(settledWith(SETTLED, { resultsKey: 'name', rowCount: 3 }))
      const first = result.current
      rerender(settledWith(SETTLED, { resultsKey: 'cases', rowCount: 3 }))
      const second = result.current

      expect(first.message).toBe('3 suites shown')
      expect(second.message).toBe('3 suites shown')
      expect(second.eventId).toBeGreaterThan(first.eventId)
    })

    it('keeps the event while the same announcement stays on screen', () => {
      const { result, rerender } = renderEvents()
      rerender(settledWith(SETTLED, { resultsKey: 'name', rowCount: 3 }))
      const announced = result.current

      rerender(settledWith(SETTLED, { resultsKey: 'name', rowCount: 3 }))

      expect(result.current).toEqual(announced)
    })

    it('moves on to a later event for a page of more suites after a change of results', () => {
      const { result, rerender } = renderEvents()
      rerender(settledWith(SETTLED, { resultsKey: 'name', rowCount: 3 }))
      const shown = result.current
      rerender(pending(SETTLED, 3))

      rerender(settledWith(SETTLED, { resultsKey: 'name', rowCount: 53, pageCount: 2 }))

      expect(result.current.message).toBe('50 more suites loaded')
      expect(result.current.eventId).toBeGreaterThan(shown.eventId)
    })

    it('has no message and an event that is not newer while nothing is announced', () => {
      const { result, rerender } = renderEvents()
      rerender(settledWith(SETTLED, { resultsKey: 'name', rowCount: 3 }))
      const shown = result.current

      rerender(pending(SETTLED, 3))

      expect(result.current.message).toBe('')
      expect(result.current.eventId).toBe(shown.eventId)
    })
  })

  describe('after a first load that failed', () => {
    const FAILED: Input = {
      resultsKey: 'recent',
      rowCount: 0,
      pageCount: 0,
      isSettled: false,
      hasFailed: true,
    }
    const RETRYING: Input = { ...FAILED, hasFailed: false }

    it('announces the suites that a retry brings', () => {
      const { result, rerender } = renderAnnouncement(FAILED)
      rerender(RETRYING)

      rerender(settledWith(RETRYING, { rowCount: 7, pageCount: 1 }))

      expect(result.current).toBe('7 suites shown')
    })

    it('announces a retry that finds no suites', () => {
      const { result, rerender } = renderAnnouncement(FAILED)
      rerender(RETRYING)

      rerender(settledWith(RETRYING, { rowCount: 0, pageCount: 1 }))

      expect(result.current).toBe('0 suites shown')
    })

    it('announces the suites even when the retry answered before the pending state was seen', () => {
      const { result, rerender } = renderAnnouncement(FAILED)

      rerender(settledWith(FAILED, { rowCount: 1, pageCount: 1, hasFailed: false }))

      expect(result.current).toBe('1 suite shown')
    })

    it('announces the suites after more than one failure', () => {
      const { result, rerender } = renderAnnouncement(FAILED)
      rerender(RETRYING)
      rerender(FAILED)
      rerender(RETRYING)

      rerender(settledWith(RETRYING, { rowCount: 3, pageCount: 1 }))

      expect(result.current).toBe('3 suites shown')
    })

    it('announces the recovery once, not again at every later settle of the same results', () => {
      const { result, rerender } = renderAnnouncement(FAILED)
      rerender(settledWith(FAILED, { rowCount: 3, pageCount: 1, hasFailed: false }))
      expect(result.current).toBe('3 suites shown')

      rerender({ ...RETRYING, rowCount: 3, pageCount: 1 })
      expect(result.current).toBe('')

      rerender(settledWith(RETRYING, { rowCount: 3, pageCount: 1 }))
      expect(result.current).toBe('')
    })

    it('does not read the first load of a list that never failed', () => {
      const loading: Input = { ...RETRYING }
      const { result, rerender } = renderAnnouncement(loading)

      rerender(settledWith(loading, { rowCount: 7, pageCount: 1 }))

      expect(result.current).toBe('')
    })
  })

  describe('after a page of more suites is loaded', () => {
    it('counts the suites that arrived', () => {
      const { result, rerender } = renderAnnouncement()

      rerender(pending(SETTLED))
      rerender(settledWith(SETTLED, { rowCount: 100, pageCount: 2 }))

      expect(result.current).toBe('50 more suites loaded')
    })

    it('uses the singular for a single suite', () => {
      const { result, rerender } = renderAnnouncement()

      rerender(pending(SETTLED))
      rerender(settledWith(SETTLED, { rowCount: 51, pageCount: 2 }))

      expect(result.current).toBe('1 more suite loaded')
    })

    it('counts only the new suites on each later page', () => {
      const { result, rerender } = renderAnnouncement()
      rerender(pending(SETTLED))
      rerender(settledWith(SETTLED, { rowCount: 100, pageCount: 2 }))

      rerender(pending(SETTLED, 100))
      rerender(settledWith(SETTLED, { rowCount: 120, pageCount: 3 }))

      expect(result.current).toBe('20 more suites loaded')
    })

    it('announces a page that answered at once, with no pending state in between', () => {
      const { result, rerender } = renderAnnouncement()

      rerender(settledWith(SETTLED, { rowCount: 100, pageCount: 2 }))

      expect(result.current).toBe('50 more suites loaded')
    })

    it('says nothing while the page is in flight', () => {
      const { result, rerender } = renderAnnouncement()

      rerender(pending(SETTLED))

      expect(result.current).toBe('')
    })

    it('clears the previous message when the next page starts', () => {
      const { result, rerender } = renderAnnouncement()
      rerender(pending(SETTLED))
      rerender(settledWith(SETTLED, { rowCount: 100, pageCount: 2 }))
      expect(result.current).toBe('50 more suites loaded')

      rerender(pending(SETTLED, 100))
      expect(result.current).toBe('')

      rerender(settledWith(SETTLED, { rowCount: 150, pageCount: 3 }))
      expect(result.current).toBe('50 more suites loaded')
    })

    it('says nothing when the page fails', () => {
      const { result, rerender } = renderAnnouncement()

      rerender(pending(SETTLED))
      rerender(settledWith(SETTLED, { rowCount: 50 }))

      expect(result.current).toBe('')
    })

    it('says nothing when the page only repeats rows that were already loaded', () => {
      const { result, rerender } = renderAnnouncement()

      rerender(settledWith(SETTLED, { rowCount: 50, pageCount: 2 }))

      expect(result.current).toBe('')
    })

    it('counts from the rows of the last settled result, so a refresh in between does not skew the count', () => {
      const { result, rerender } = renderAnnouncement()
      rerender(settledWith(SETTLED, { rowCount: 52 }))

      rerender(settledWith(SETTLED, { rowCount: 102, pageCount: 2 }))

      expect(result.current).toBe('50 more suites loaded')
    })

    it('counts from the rows left by a page that only repeated rows', () => {
      const { result, rerender } = renderAnnouncement()
      rerender(settledWith(SETTLED, { rowCount: 50, pageCount: 2 }))

      rerender(settledWith(SETTLED, { rowCount: 70, pageCount: 3 }))

      expect(result.current).toBe('20 more suites loaded')
    })

    it('is spoken in Spanish with the right plural', () => {
      act(() => {
        useI18nStore.setState({ locale: 'es' })
      })
      const { result, rerender } = renderAnnouncement()

      rerender(pending(SETTLED))
      rerender(settledWith(SETTLED, { rowCount: 100, pageCount: 2 }))
      expect(result.current).toBe('Se cargaron 50 suites más')

      rerender(pending(SETTLED, 100))
      rerender(settledWith(SETTLED, { rowCount: 101, pageCount: 3 }))
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
      rerender(pending(SETTLED))

      rerender(settledWith(SETTLED, { resultsKey: 'recent+abc', rowCount: 2, pageCount: 2 }))

      expect(result.current).toBe('2 suites shown')
    })

    it('says nothing when the same results settle again with other rows, as a refresh does', () => {
      const { result, rerender } = renderAnnouncement()

      rerender(settledWith(SETTLED, { rowCount: 52 }))

      expect(result.current).toBe('')
    })

    it('is spoken in Spanish with the right plural', () => {
      act(() => {
        useI18nStore.setState({ locale: 'es' })
      })
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
