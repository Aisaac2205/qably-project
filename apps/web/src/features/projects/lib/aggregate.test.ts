/**
 * useProjectAggregate — transactional aggregate hook for the projects module.
 *
 * Contract:
 * - `projects` returns the live list of projects (useSyncExternalStore).
 * - `project(id)` returns the project or `undefined` if missing.
 * - `create(input)` appends a new project + emits `project.created`.
 * - `update(id, patch)` mutates an existing project + emits `project.updated`.
 * - `delete(id)` removes the project + returns `true`; missing id → `false`.
 * - `transition` is `never` — projects have no state machine.
 * - Direct imports of `mockStore` mutations from outside `features/projects/`
 *   are NOT permitted (per REQ-PROJ-005).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useProjectAggregate } from './aggregate'
import { __resetStore, getProjects } from '@/lib/mock-store'
import { eventBus } from '@/lib/event-bus'

describe('useProjectAggregate — shape', () => {
  beforeEach(() => {
    __resetStore()
    const emitter = (eventBus as unknown as { emitter: { removeAllListeners(): void } }).emitter
    emitter.removeAllListeners()
  })

  it('returns the contract shape with transition: never', () => {
    const { result } = renderHook(() => useProjectAggregate())
    expect(result.current.projects).toBeInstanceOf(Array)
    expect(typeof result.current.project).toBe('function')
    expect(typeof result.current.create).toBe('function')
    expect(typeof result.current.update).toBe('function')
    expect(typeof result.current.delete).toBe('function')
    // transition must be `never` — projects have no state machine.
    expect((result.current as { transition?: unknown }).transition).toBeUndefined()
  })

  it('project(id) returns the project by id, undefined for missing', () => {
    const { result } = renderHook(() => useProjectAggregate())
    expect(result.current.project('proj-1')?.name).toBe('Ecommerce App')
    expect(result.current.project('proj-does-not-exist')).toBeUndefined()
  })
})

describe('useProjectAggregate — mutations + events', () => {
  beforeEach(() => {
    __resetStore()
    const emitter = (eventBus as unknown as { emitter: { removeAllListeners(): void } }).emitter
    emitter.removeAllListeners()
  })

  it('create appends a new project and emits project.created', () => {
    const listener = vi.fn()
    eventBus.on('project.created', listener)

    const { result } = renderHook(() => useProjectAggregate())
    let createdId = ''
    act(() => {
      createdId = result.current.create({ name: 'New Project', description: 'desc' }).id
    })

    expect(createdId).toBeTruthy()
    const list = getProjects()
    expect(list.find((p) => p.id === createdId)?.name).toBe('New Project')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ projectId: createdId })
  })

  it('update mutates the project and emits project.updated', () => {
    const listener = vi.fn()
    eventBus.on('project.updated', listener)

    const { result } = renderHook(() => useProjectAggregate())
    act(() => {
      result.current.update('proj-1', { name: 'Renamed' })
    })

    expect(result.current.project('proj-1')?.name).toBe('Renamed')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith({ projectId: 'proj-1' })
  })

  it('update returns undefined for a missing id and emits nothing', () => {
    const listener = vi.fn()
    eventBus.on('project.updated', listener)

    const { result } = renderHook(() => useProjectAggregate())
    let out: unknown = 'sentinel'
    act(() => {
      out = result.current.update('proj-missing', { name: 'X' })
    })
    expect(out).toBeUndefined()
    expect(listener).not.toHaveBeenCalled()
  })

  it('delete removes the project and returns true; false for missing', () => {
    const { result } = renderHook(() => useProjectAggregate())
    act(() => {
      expect(result.current.delete('proj-1')).toBe(true)
    })
    expect(result.current.project('proj-1')).toBeUndefined()
    act(() => {
      expect(result.current.delete('proj-missing')).toBe(false)
    })
  })
})
