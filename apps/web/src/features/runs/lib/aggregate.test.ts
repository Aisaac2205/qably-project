/**
 * useRunAggregate — transactional aggregate hook for the runs module.
 *
 * Contract:
 * - `runs` is the live list (optionally filtered by `projectId`).
 * - `run(id)` returns the run or undefined if missing.
 * - `create(input)` appends a new run. Does NOT emit (per AppEventMap).
 * - `update(id, patch)` mutates name / status / passRate / etc. Does NOT emit.
 * - `delete(id)` removes the run. Returns true on success, false if missing.
 * - `transition(id, 'start')` moves pending → running, emits `run.started`.
 * - `transition(id, 'complete')` moves running → pass, emits `run.completed`.
 * - `transition(id, 'fail')` moves running → fail, emits `run.completed`.
 * - Invalid transitions return undefined and emit nothing.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRunAggregate } from './aggregate'
import { __resetStore, getRuns } from '@/lib/mock-store'
import { eventBus } from '@/lib/event-bus'

type EmitterInternals = { emitter: { removeAllListeners(): void } }

const clearBus = () => {
  const internals = eventBus as unknown as EmitterInternals
  internals.emitter.removeAllListeners()
}

describe('useRunAggregate — shape', () => {
  beforeEach(() => {
    __resetStore()
    clearBus()
  })

  it('returns the contract shape with transition', () => {
    const { result } = renderHook(() => useRunAggregate())
    expect(result.current.runs).toBeInstanceOf(Array)
    expect(typeof result.current.run).toBe('function')
    expect(typeof result.current.create).toBe('function')
    expect(typeof result.current.update).toBe('function')
    expect(typeof result.current.delete).toBe('function')
    expect(typeof result.current.transition).toBe('function')
  })

  it('filters runs by projectId when provided', () => {
    const all = renderHook(() => useRunAggregate()).result.current.runs
    const filtered = renderHook(() => useRunAggregate('proj-1')).result.current.runs
    expect(filtered.length).toBeLessThanOrEqual(all.length)
    for (const r of filtered) expect(r.projectId).toBe('proj-1')
  })

  it('run(id) returns the run or undefined', () => {
    const { result } = renderHook(() => useRunAggregate())
    const found = result.current.run('run-11')
    expect(found).toBeDefined()
    expect(found?.id).toBe('run-11')
    expect(result.current.run('missing')).toBeUndefined()
  })
})

describe('useRunAggregate — CRUD', () => {
  beforeEach(() => {
    __resetStore()
    clearBus()
  })

  it('create appends a new run; does NOT emit', () => {
    const listener = vi.fn()
    eventBus.on('run.started', listener)
    eventBus.on('run.completed', listener)

    const { result } = renderHook(() => useRunAggregate())
    const before = getRuns().length
    act(() => {
      result.current.create({ projectId: 'proj-1', suiteId: 'suite-1', name: 'New run' })
    })
    expect(getRuns().length).toBe(before + 1)
    // create does not emit
    expect(listener).not.toHaveBeenCalled()
  })

  it('update mutates the run; does NOT emit', () => {
    const listener = vi.fn()
    eventBus.on('run.completed', listener)

    const { result } = renderHook(() => useRunAggregate())
    act(() => {
      result.current.update('run-11', { name: 'Renamed' })
    })
    expect(result.current.run('run-11')?.name).toBe('Renamed')
    expect(listener).not.toHaveBeenCalled()
  })

  it('delete removes the run and returns true; false for missing', () => {
    const { result } = renderHook(() => useRunAggregate())
    act(() => {
      expect(result.current.delete('run-11')).toBe(true)
    })
    expect(result.current.run('run-11')).toBeUndefined()
    act(() => {
      expect(result.current.delete('missing')).toBe(false)
    })
  })
})

describe('useRunAggregate — transition state machine', () => {
  beforeEach(() => {
    __resetStore()
    clearBus()
  })

  it('complete: running → pass, emits run.completed with status=pass', () => {
    // run-12 is the first run in the seed (mockRun) — verify it's running
    const run = renderHook(() => useRunAggregate()).result.current.run('run-12')
    if (!run) throw new Error('expected run-12 in seed data')

    const listener = vi.fn()
    eventBus.on('run.completed', listener)

    const { result } = renderHook(() => useRunAggregate())
    act(() => {
      // Force the run into 'running' status first
      result.current.update('run-12', { status: 'running' })
      const updated = result.current.transition('run-12', 'complete')
      expect(updated?.status).toBe('pass')
    })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run-12', status: 'pass' }),
    )
  })

  it('fail: running → fail, emits run.completed with status=fail', () => {
    const listener = vi.fn()
    eventBus.on('run.completed', listener)

    const { result } = renderHook(() => useRunAggregate())
    act(() => {
      result.current.update('run-12', { status: 'running' })
      const updated = result.current.transition('run-12', 'fail')
      expect(updated?.status).toBe('fail')
    })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run-12', status: 'fail' }),
    )
  })

  it('start: pending → running, emits run.started', () => {
    const listener = vi.fn()
    eventBus.on('run.started', listener)

    const { result } = renderHook(() => useRunAggregate())
    act(() => {
      result.current.update('run-12', { status: 'pending' })
      const updated = result.current.transition('run-12', 'start')
      expect(updated?.status).toBe('running')
    })
    expect(listener).toHaveBeenCalledTimes(1)
    // source is whatever the seed run has; we just check runId + projectId
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run-12', projectId: 'proj-1' }),
    )
  })

  it('invalid transition (complete on pass) returns undefined, emits nothing', () => {
    const listener = vi.fn()
    eventBus.on('run.completed', listener)

    const { result } = renderHook(() => useRunAggregate())
    act(() => {
      // run-11 is already 'pass' in seed data
      expect(result.current.transition('run-11', 'complete')).toBeUndefined()
    })
    expect(listener).not.toHaveBeenCalled()
  })

  it('transition on missing id returns undefined and emits nothing', () => {
    const listener = vi.fn()
    eventBus.on('run.completed', listener)
    eventBus.on('run.started', listener)

    const { result } = renderHook(() => useRunAggregate())
    act(() => {
      expect(result.current.transition('missing', 'start')).toBeUndefined()
      expect(result.current.transition('missing', 'complete')).toBeUndefined()
    })
    expect(listener).not.toHaveBeenCalled()
  })
})
