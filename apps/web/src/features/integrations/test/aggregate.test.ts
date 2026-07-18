/**
 * useConnections — transactional aggregate hook for the integrations module.
 *
 * Contract (mirrors useProjectAggregate, with a state machine via transition):
 * - `connections` returns the live list (useSyncExternalStore).
 * - `connection(id)` returns the connection or `undefined` if missing.
 * - `create(input)` appends a new connection in `pending` status. Does NOT
 *   emit (per AppEventMap — only `transition` emits `connection.added`).
 * - `update(id, patch)` mutates name / config / lastSyncAt. Does NOT emit.
 * - `delete(id)` removes the connection + returns `true`; missing id → `false`.
 *   Emits `connection.removed` on success.
 * - `transition(id, action)` runs the state machine:
 *   - 'connect'    → `pending` / `disconnected` → `connected` + emits `connection.added`
 *   - 'disconnect' → `connected` / `pending`     → `disconnected` + emits `connection.removed`
 *   - Invalid transitions return `undefined` and emit nothing.
 * - Direct imports of `mockStore` mutations from outside `features/integrations/`
 *   are NOT permitted (per REQ-INTEG-009).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConnections } from '@/features/integrations/lib/aggregate'
import { __resetStore, getConnections } from '@/lib/mock-store'
import { eventBus } from '@/lib/event-bus'

function clearBus() {
  const emitter = (eventBus as unknown as { emitter: { removeAllListeners(): void } }).emitter
  emitter.removeAllListeners()
}

describe('useConnections — shape', () => {
  beforeEach(() => {
    __resetStore()
    clearBus()
  })

  it('returns the contract shape with the full CRUD + transition surface', () => {
    const { result } = renderHook(() => useConnections())
    expect(result.current.connections).toBeInstanceOf(Array)
    expect(typeof result.current.connection).toBe('function')
    expect(typeof result.current.create).toBe('function')
    expect(typeof result.current.update).toBe('function')
    expect(typeof result.current.delete).toBe('function')
    expect(typeof result.current.transition).toBe('function')
  })

  it('connection(id) returns the connection by id, undefined for missing', () => {
    const { result } = renderHook(() => useConnections())
    const found = result.current.connection('conn-1')
    expect(found).toBeDefined()
    expect(found?.id).toBe('conn-1')
    expect(result.current.connection('conn-does-not-exist')).toBeUndefined()
  })
})

describe('useConnections — CRUD + events', () => {
  beforeEach(() => {
    __resetStore()
    clearBus()
  })

  it('create appends a new connection in pending status (does NOT emit — only transition emits)', () => {
    const listener = vi.fn()
    eventBus.on('connection.added', listener)

    const { result } = renderHook(() => useConnections())
    let createdId = ''
    act(() => {
      createdId = result.current.create({ type: 'github', name: 'New Repo' }).id
    })

    expect(createdId).toBeTruthy()
    const list = getConnections()
    expect(list.find((c) => c.id === createdId)?.name).toBe('New Repo')
    expect(listener).not.toHaveBeenCalled()
  })

  it('update mutates the connection and does not throw for missing id', () => {
    const { result } = renderHook(() => useConnections())
    act(() => {
      const updated = result.current.update('conn-1', { name: 'Renamed' })
      expect(updated?.name).toBe('Renamed')
    })
    expect(result.current.connection('conn-1')?.name).toBe('Renamed')
    act(() => {
      const out = result.current.update('conn-missing', { name: 'X' })
      expect(out).toBeUndefined()
    })
  })

  it('delete removes the connection and returns true; false for missing', () => {
    const { result } = renderHook(() => useConnections())
    act(() => {
      expect(result.current.delete('conn-1')).toBe(true)
    })
    expect(result.current.connection('conn-1')).toBeUndefined()
    act(() => {
      expect(result.current.delete('conn-missing')).toBe(false)
    })
  })
})

describe('useConnections — transition state machine', () => {
  beforeEach(() => {
    __resetStore()
    clearBus()
  })

  it("transition('connect') moves a pending connection to connected and emits connection.added", () => {
    const listener = vi.fn()
    eventBus.on('connection.added', listener)

    const { result } = renderHook(() => useConnections())
    // conn-1 starts pending in the seed data
    expect(result.current.connection('conn-1')?.status).toBe('pending')

    act(() => {
      const updated = result.current.transition('conn-1', 'connect')
      expect(updated?.status).toBe('connected')
    })

    expect(result.current.connection('conn-1')?.status).toBe('connected')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ connectionId: 'conn-1', provider: 'github' })
  })

  it("transition('disconnect') moves a connected connection to disconnected and emits connection.removed", () => {
    const listener = vi.fn()
    eventBus.on('connection.removed', listener)

    const { result } = renderHook(() => useConnections())
    // First connect, then disconnect
    act(() => {
      result.current.transition('conn-1', 'connect')
    })
    listener.mockClear()

    act(() => {
      const updated = result.current.transition('conn-1', 'disconnect')
      expect(updated?.status).toBe('disconnected')
    })

    expect(result.current.connection('conn-1')?.status).toBe('disconnected')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ connectionId: 'conn-1' })
  })

  it('transition returns undefined for missing id and emits nothing', () => {
    const added = vi.fn()
    const removed = vi.fn()
    eventBus.on('connection.added', added)
    eventBus.on('connection.removed', removed)

    const { result } = renderHook(() => useConnections())
    act(() => {
      expect(result.current.transition('conn-missing', 'connect')).toBeUndefined()
    })

    expect(added).not.toHaveBeenCalled()
    expect(removed).not.toHaveBeenCalled()
  })
})
