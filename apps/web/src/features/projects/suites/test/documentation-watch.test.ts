import { describe, expect, it } from 'vitest'
import {
  DOCUMENTATION_POLL_INTERVAL_MS,
  DOCUMENTATION_WATCH_WINDOW_MS,
  deriveWatchStatus,
  documentedSince,
  pollIntervalFor,
} from '@/features/projects/suites/lib/documentation-watch'

const startedAt = 1_000_000

function watch(baselineCount: number) {
  return { startedAt, baselineCount }
}

describe('deriveWatchStatus', () => {
  it('is idle while no documentation run is outstanding', () => {
    expect(deriveWatchStatus(null, 7, startedAt)).toBe('idle')
  })

  it('is working while the count has not moved inside the window', () => {
    expect(deriveWatchStatus(watch(7), 7, startedAt + 5_000)).toBe('working')
  })

  it('settles as soon as the count the read model carries drops', () => {
    expect(deriveWatchStatus(watch(7), 3, startedAt + 5_000)).toBe('settled')
  })

  it('settles even when the drop arrives after the window elapsed', () => {
    expect(
      deriveWatchStatus(watch(7), 0, startedAt + DOCUMENTATION_WATCH_WINDOW_MS + 1),
    ).toBe('settled')
  })

  it('stops claiming progress once the window elapses with the count unmoved', () => {
    expect(
      deriveWatchStatus(watch(7), 7, startedAt + DOCUMENTATION_WATCH_WINDOW_MS),
    ).toBe('timed-out')
  })

  it('keeps working when new cases were ingested and the count went up instead', () => {
    expect(deriveWatchStatus(watch(7), 9, startedAt + 5_000)).toBe('working')
  })

  it('treats a run that targeted an already-empty count as settled at zero', () => {
    expect(deriveWatchStatus(watch(1), 0, startedAt + 1_000)).toBe('settled')
  })

  it('keeps working rather than claiming success while the suite is unknown', () => {
    expect(deriveWatchStatus(watch(7), undefined, startedAt + 5_000)).toBe('working')
  })

  it('times out on an unknown suite too, instead of polling forever', () => {
    expect(
      deriveWatchStatus(watch(7), undefined, startedAt + DOCUMENTATION_WATCH_WINDOW_MS),
    ).toBe('timed-out')
  })
})

describe('documentedSince', () => {
  it('reports how far the count actually fell', () => {
    expect(documentedSince(watch(12), 0)).toBe(12)
    expect(documentedSince(watch(12), 5)).toBe(7)
  })

  it('never invents progress when the count grew or is unknown', () => {
    expect(documentedSince(watch(7), 9)).toBe(0)
    expect(documentedSince(watch(7), undefined)).toBe(0)
    expect(documentedSince(null, 3)).toBe(0)
  })
})

describe('pollIntervalFor', () => {
  it('polls only while the work is still outstanding', () => {
    expect(pollIntervalFor('working')).toBe(DOCUMENTATION_POLL_INTERVAL_MS)
  })

  it('stops polling on every terminal state', () => {
    expect(pollIntervalFor('idle')).toBe(false)
    expect(pollIntervalFor('settled')).toBe(false)
    expect(pollIntervalFor('timed-out')).toBe(false)
  })
})
