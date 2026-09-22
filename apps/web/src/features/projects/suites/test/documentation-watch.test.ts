import { describe, expect, it } from 'vitest'
import {
  DOCUMENTATION_POLL_INTERVAL_MS,
  DOCUMENTATION_SETTLE_GRACE_POLLS,
  DOCUMENTATION_WATCH_WINDOW_MS,
  beginWatch,
  deriveWatchStatus,
  documentedSince,
  observeWatch,
  pollIntervalFor,
  type DocumentationWatch,
} from '@/features/projects/suites/lib/documentation-watch'

const startedAt = 1_000_000

function watch(overrides: Partial<DocumentationWatch> = {}): DocumentationWatch {
  return { startedAt, baselineCount: 7, sawBusy: false, idlePolls: 0, ...overrides }
}

describe('deriveWatchStatus', () => {
  it('is idle while no documentation run is outstanding', () => {
    expect(deriveWatchStatus(null, false, startedAt)).toBe('idle')
  })

  it('is working while the suite still reports a case or itself as documenting', () => {
    expect(deriveWatchStatus(watch(), true, startedAt + 5_000)).toBe('working')
  })

  it('does not settle on a stale snapshot taken right after begin(), before any poll observed it busy', () => {
    expect(deriveWatchStatus(watch(), false, startedAt + 500)).toBe('working')
  })

  it('settles once the persisted state clears after actually having been observed busy', () => {
    expect(deriveWatchStatus(watch({ sawBusy: true }), false, startedAt + 5_000)).toBe('settled')
  })

  it('settles after the grace of not-busy polls elapses even when busy was never observed', () => {
    expect(
      deriveWatchStatus(
        watch({ idlePolls: DOCUMENTATION_SETTLE_GRACE_POLLS }),
        false,
        startedAt + 5_000,
      ),
    ).toBe('settled')
  })

  it('stops claiming progress once the window elapses while still documenting', () => {
    expect(
      deriveWatchStatus(watch(), true, startedAt + DOCUMENTATION_WATCH_WINDOW_MS),
    ).toBe('timed-out')
  })
})

describe('observeWatch', () => {
  it('settles only at the third tick for a stale-first-tick sequence (not busy, busy, not busy)', () => {
    let state = beginWatch(startedAt, 7)

    state = observeWatch(state, false)
    expect(deriveWatchStatus(state, false, startedAt)).toBe('working')

    state = observeWatch(state, true)
    expect(deriveWatchStatus(state, true, startedAt)).toBe('working')

    state = observeWatch(state, false)
    expect(deriveWatchStatus(state, false, startedAt)).toBe('settled')
  })

  it('settles after the grace period, not immediately, when busy is never observed', () => {
    let state = beginWatch(startedAt, 7)

    state = observeWatch(state, false)
    expect(deriveWatchStatus(state, false, startedAt)).toBe('working')

    state = observeWatch(state, false)
    expect(deriveWatchStatus(state, false, startedAt)).toBe('settled')
  })

  it('keeps sawBusy sticky once observed, even across further not-busy polls', () => {
    let state = beginWatch(startedAt, 7)
    state = observeWatch(state, true)
    state = observeWatch(state, false)
    state = observeWatch(state, false)

    expect(deriveWatchStatus(state, false, startedAt)).toBe('settled')
  })
})

describe('documentedSince', () => {
  it('reports how far the count actually fell', () => {
    expect(documentedSince(watch(), 0)).toBe(7)
    expect(documentedSince(watch({ baselineCount: 12 }), 5)).toBe(7)
  })

  it('never invents progress when the count grew or is unknown', () => {
    expect(documentedSince(watch({ baselineCount: 7 }), 9)).toBe(0)
    expect(documentedSince(watch({ baselineCount: 7 }), undefined)).toBe(0)
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
