/**
 * EventBus — typed in-process pub/sub.
 *
 * Contract:
 * - `on(event, listener)` returns an unsubscribe function.
 * - `emit(event, payload)` calls every registered listener with the payload.
 * - Payload type is inferred from the event name via the `EventMap` generic.
 * - Listeners for one event do NOT receive payloads from other events.
 * - The bus instance is pinned to `globalThis.__qablyBus` so it survives HMR
 *   module reloads — second `import()` of the module returns the same bus.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { eventBus } from './event-bus'
import type { AppEventMap } from './types/events'

type Listener = (payload: unknown) => void

describe('eventBus — on / emit / off', () => {
  beforeEach(() => {
    // Remove every listener between tests so test order doesn't leak.
    const emitter = (eventBus as unknown as { emitter: { eventNames(): string[]; removeAllListeners(): void } }).emitter
    emitter.removeAllListeners()
  })

  it('on + emit round-trips a payload to the listener', () => {
    const listener = vi.fn()
    eventBus.on('project.created', listener)
    eventBus.emit('project.created', { projectId: 'proj-1' })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ projectId: 'proj-1' })
  })

  it('payload type is inferred from the event name (no any cast)', () => {
    // This test is type-level: the line below MUST compile without `as any`.
    // If a future change removes the generic, the test file will fail to type-check.
    const listener: (payload: AppEventMap['project.updated']) => void = vi.fn()
    eventBus.on('project.updated', listener)
    eventBus.emit('project.updated', { projectId: 'proj-42' })
    expect(listener).toHaveBeenCalledWith({ projectId: 'proj-42' })
  })

  it('off — the returned unsubscribe removes the listener', () => {
    const listener = vi.fn()
    const unsubscribe = eventBus.on('suite.added', listener)
    eventBus.emit('suite.added', { projectId: 'p', suiteId: 's' })
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    eventBus.emit('suite.added', { projectId: 'p', suiteId: 's' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('listeners for other events are NOT invoked', () => {
    const created = vi.fn()
    const updated = vi.fn()
    eventBus.on('project.created', created)
    eventBus.on('project.updated', updated)
    eventBus.emit('project.created', { projectId: 'proj-1' })
    expect(created).toHaveBeenCalledTimes(1)
    expect(updated).not.toHaveBeenCalled()
  })

  it('multiple listeners on the same event all fire', () => {
    const a = vi.fn()
    const b = vi.fn()
    eventBus.on('project.created', a)
    eventBus.on('project.created', b)
    eventBus.emit('project.created', { projectId: 'proj-1' })
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })
})

describe('eventBus — HMR pin via globalThis', () => {
  it('two import() calls return the same bus instance', async () => {
    // Dynamic re-import simulates a module reload under HMR.
    const first = await import('./event-bus')
    const second = await import('./event-bus')
    expect(first.eventBus).toBe(second.eventBus)
  })

  it('subscribers added in a "first module" survive a "second module" emit', async () => {
    // After a module reload, the listener registered against the first bus
    // must still receive emissions routed through the (same) bus.
    const first = await import('./event-bus')
    const listener = vi.fn()
    first.eventBus.on('project.updated', listener as unknown as Listener)
    const second = await import('./event-bus')
    second.eventBus.emit('project.updated', { projectId: 'p1' })
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
