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
    expect(deriveWatchStatus(null, false, startedAt)).toBe('idle')
  })

  it('is working while the suite still reports a case or itself as documenting', () => {
    expect(deriveWatchStatus(watch(7), true, startedAt + 5_000)).toBe('working')
  })

  it('settles as soon as the persisted state shows nothing left documenting', () => {
    expect(deriveWatchStatus(watch(7), false, startedAt + 5_000)).toBe('settled')
  })

  it('settles even when the persisted state clears after the window elapsed', () => {
    expect(
      deriveWatchStatus(watch(7), false, startedAt + DOCUMENTATION_WATCH_WINDOW_MS + 1),
    ).toBe('settled')
  })

  it('stops claiming progress once the window elapses while still documenting', () => {
    expect(
      deriveWatchStatus(watch(7), true, startedAt + DOCUMENTATION_WATCH_WINDOW_MS),
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
