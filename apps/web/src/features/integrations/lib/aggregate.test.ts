/**
 * useConnections — transactional aggregate hook for the integrations module.
 *
 * Contract:
 * - Returns the contract shape including `transition`.
 * - `create(input)` appends a new connection in `pending` status.
 * - `update(id, patch)` mutates name / config / lastSyncAt; returns
 *   the connection or undefined if id is missing.
 * - `delete(id)` removes the connection and emits `connection.removed`
 *   if it existed.
 * - `transition(id, 'connect')` moves pending|disconnected → connected
 *   and emits `connection.added` on success.
 * - `transition(id, 'disconnect')` moves connected|pending → disconnected
 *   and emits `connection.removed` on success.
 * - Invalid transitions return undefined and emit nothing.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useConnections } from './aggregate'
import { __resetStore, getConnections } from '@/lib/mock-store'
import { eventBus } from '@/lib/event-bus'

type EmitterInternals = { emitter: { removeAllListeners(): void } }

const clearBus = () => {
  const internals = eventBus as unknown as EmitterInternals
  internals.emitter.removeAllListeners()
}

describe('useConnections — shape', () => {
  beforeEach(() => {
    __resetStore()
    clearBus()
  })

  it('returns the contract shape with transition', () => {
    const { result } = renderHook(() => useConnections())
    expect(result.current.connections).toBeInstanceOf(Array)
    expect(typeof result.current.connection).toBe('function')
    expect(typeof result.current.create).toBe('function')
    expect(typeof result.current.update).toBe('function')
    expect(typeof result.current.delete).toBe('function')
    expect(typeof result.current.transition).toBe('function')
  })

  it('connection(id) returns the connection or undefined', () => {
    const { result } = renderHook(() => useConnections())
    expect(result.current.connection('conn-1')?.name).toBe('acme/ecommerce-app')
    expect(result.current.connection('missing')).toBeUndefined()
  })
})

describe('useConnections — CRUD', () => {
  beforeEach(() => {
    __resetStore()
    clearBus()
  })

  it('create appends a new connection in pending status (no event — only transition emits)', () => {
    const listener = vi.fn()
    eventBus.on('connection.added', listener)

    const { result } = renderHook(() => useConnections())
    let createdId = ''
    act(() => {
      createdId = result.current
        .create({ type: 'github', name: 'new-repo', config: { repoUrl: 'https://github.com/x' } })
        .id
    })
    expect(createdId).toBeTruthy()
    const list = getConnections()
    expect(list.find((c) => c.id === createdId)?.name).toBe('new-repo')
    expect(list.find((c) => c.id === createdId)?.status).toBe('pending')
    // create does not emit — only transition('connect') does (per AppEventMap).
    expect(listener).not.toHaveBeenCalled()
  })

  it('update mutates the connection', () => {
    const { result } = renderHook(() => useConnections())
    act(() => {
      const updated = result.current.update('conn-1', { name: 'renamed' })
      expect(updated?.name).toBe('renamed')
    })
    expect(result.current.connection('conn-1')?.name).toBe('renamed')
  })

  it('update returns undefined for a missing id', () => {
    const { result } = renderHook(() => useConnections())
    act(() => {
      expect(result.current.update('missing', { name: 'X' })).toBeUndefined()
    })
  })

  it('delete removes the connection and returns true; false for missing', () => {
    const { result } = renderHook(() => useConnections())
    act(() => {
      expect(result.current.delete('conn-1')).toBe(true)
    })
    expect(result.current.connection('conn-1')).toBeUndefined()
    act(() => {
      expect(result.current.delete('missing')).toBe(false)
    })
  })
})

describe('useConnections — transition state machine', () => {
  beforeEach(() => {
    __resetStore()
    clearBus()
  })

  it('connect: pending → connected, emits connection.added', () => {
    const listener = vi.fn()
    eventBus.on('connection.added', listener)

    const { result } = renderHook(() => useConnections())
    act(() => {
      const updated = result.current.transition('conn-1', 'connect')
      expect(updated?.status).toBe('connected')
    })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ connectionId: 'conn-1', provider: 'github' })
  })

  it('connect: disconnected → connected, emits connection.added', () => {
    const listener = vi.fn()
    eventBus.on('connection.added', listener)

    const { result } = renderHook(() => useConnections())
    act(() => {
      const updated = result.current.transition('conn-3', 'connect') // conn-3 is email, disconnected
      expect(updated?.status).toBe('connected')
    })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('disconnect: connected → disconnected, emits connection.removed', () => {
    const listener = vi.fn()
    eventBus.on('connection.removed', listener)

    const { result } = renderHook(() => useConnections())
    act(() => {
      const updated = result.current.transition('conn-2', 'disconnect') // conn-2 is slack, connected
      expect(updated?.status).toBe('disconnected')
    })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ connectionId: 'conn-2' })
  })

  it('invalid transition (connect on connected) returns undefined, emits nothing', () => {
    const listener = vi.fn()
    eventBus.on('connection.added', listener)

    const { result } = renderHook(() => useConnections())
    act(() => {
      expect(result.current.transition('conn-2', 'connect')).toBeUndefined() // conn-2 already connected
    })
    expect(listener).not.toHaveBeenCalled()
  })

  it('invalid transition (disconnect on disconnected) returns undefined, emits nothing', () => {
    const listener = vi.fn()
    eventBus.on('connection.removed', listener)

    const { result } = renderHook(() => useConnections())
    act(() => {
      expect(result.current.transition('conn-3', 'disconnect')).toBeUndefined() // conn-3 already disconnected
    })
    expect(listener).not.toHaveBeenCalled()
  })

  it('delete emits connection.removed', () => {
    const listener = vi.fn()
    eventBus.on('connection.removed', listener)

    const { result } = renderHook(() => useConnections())
    act(() => {
      result.current.delete('conn-1')
    })
    expect(listener).toHaveBeenCalledWith({ connectionId: 'conn-1' })
  })
})
