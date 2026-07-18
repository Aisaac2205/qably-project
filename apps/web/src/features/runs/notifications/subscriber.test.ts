/**
 * registerRunSubscriber — listens to `ci.event.received` and transitions runs.
 *
 * Contract:
 * - On `ci.event.received` with a `runId` matching a real run in mock-store:
 *     - If run.status === 'running' → calls transitionRun(runId, 'complete' | 'fail')
 *       based on event.status. The transition emits `run.completed` per
 *       useRunAggregate.
 *     - If run.status !== 'running' → no-op (the subscriber does not retroactively
 *       change a completed run).
 * - On missing run → no-op.
 * - Strips the `github-` / `bitbucket-` / `gitlab-` provider prefix that the
 *   CI adapters add when normalising the event.
 * - The returned function unsubscribes (HMR-safe via useEffect cleanup).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { registerRunSubscriber } from './subscriber'
import { __resetStore, getRun, getRuns, updateRun } from '@/lib/mock-store'
import { eventBus } from '@/lib/event-bus'
import type { NormalizedCIEvent } from '@/features/integrations/ci-providers/types'

type EmitterInternals = { emitter: { removeAllListeners(): void } }
const clearBus = () => {
  const internals = eventBus as unknown as EmitterInternals
  internals.emitter.removeAllListeners()
}

function fakeEvent(overrides: Partial<NormalizedCIEvent> = {}): NormalizedCIEvent {
  return {
    eventId: 'check-run-1',
    runId: 'github-run-12',
    provider: 'github',
    status: 'completed',
    commitSha: 'sha-abc',
    repository: 'acme/repo',
    url: 'https://github.com/acme/repo/runs/1',
    receivedAt: '2026-06-16T10:00:00Z',
    ...overrides,
  }
}

describe('registerRunSubscriber — happy path', () => {
  beforeEach(() => {
    __resetStore()
    clearBus()
  })

  it('transitions a running run to pass on a completed event', () => {
    // Force run-12 to running state
    
    updateRun('run-12', { status: 'running' })
    expect(getRun('run-12')?.status).toBe('running')

    const completedListener = vi.fn()
    eventBus.on('run.completed', completedListener)

    const unsub = registerRunSubscriber()
    eventBus.emit('ci.event.received', { event: fakeEvent({ runId: 'github-run-12', status: 'completed' }) })

    expect(getRun('run-12')?.status).toBe('pass')
    expect(completedListener).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run-12', status: 'pass' }),
    )
    unsub()
  })

  it('transitions a running run to fail on a failed event', () => {
    
    updateRun('run-12', { status: 'running' })

    const completedListener = vi.fn()
    eventBus.on('run.completed', completedListener)

    const unsub = registerRunSubscriber()
    eventBus.emit('ci.event.received', { event: fakeEvent({ runId: 'github-run-12', status: 'failed' }) })

    expect(getRun('run-12')?.status).toBe('fail')
    expect(completedListener).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run-12', status: 'fail' }),
    )
    unsub()
  })
})

describe('registerRunSubscriber — edge cases', () => {
  beforeEach(() => {
    __resetStore()
    clearBus()
  })

  it('no-op when the run does not exist', () => {
    const completedListener = vi.fn()
    eventBus.on('run.completed', completedListener)

    const unsub = registerRunSubscriber()
    eventBus.emit('ci.event.received', { event: fakeEvent({ runId: 'github-missing' }) })

    expect(completedListener).not.toHaveBeenCalled()
    unsub()
  })

  it('no-op when the run is not in running state', () => {
    const completedListener = vi.fn()
    eventBus.on('run.completed', completedListener)

    // run-11 is 'pass' in seed data
    expect(getRun('run-11')?.status).toBe('pass')

    const unsub = registerRunSubscriber()
    eventBus.emit('ci.event.received', { event: fakeEvent({ runId: 'github-run-11' }) })

    expect(getRun('run-11')?.status).toBe('pass') // unchanged
    expect(completedListener).not.toHaveBeenCalled()
    unsub()
  })

  it('strips bitbucket- and gitlab- provider prefixes', () => {
    
    updateRun('run-12', { status: 'running' })

    const completedListener = vi.fn()
    eventBus.on('run.completed', completedListener)

    const unsub = registerRunSubscriber()
    eventBus.emit('ci.event.received', { event: fakeEvent({ runId: 'bitbucket-run-12' }) })
    expect(getRun('run-12')?.status).toBe('pass')

    updateRun('run-12', { status: 'running' })
    eventBus.emit('ci.event.received', { event: fakeEvent({ runId: 'gitlab-run-12' }) })
    expect(getRun('run-12')?.status).toBe('pass')

    expect(completedListener).toHaveBeenCalledTimes(2)
    unsub()
  })
})

describe('registerRunSubscriber — unsubscribe is HMR-safe', () => {
  beforeEach(() => {
    __resetStore()
    clearBus()
  })

  it('returned function removes the listener', () => {
    
    updateRun('run-12', { status: 'running' })

    const completedListener = vi.fn()
    eventBus.on('run.completed', completedListener)

    const unsub = registerRunSubscriber()
    eventBus.emit('ci.event.received', { event: fakeEvent() })
    expect(completedListener).toHaveBeenCalledTimes(1)

    unsub()
    updateRun('run-12', { status: 'running' })
    eventBus.emit('ci.event.received', { event: fakeEvent() })
    expect(completedListener).toHaveBeenCalledTimes(1) // unchanged — listener removed
  })
})
