/**
 * EventBus — typed in-process pub/sub.
 *
 * Built on Node's `EventEmitter`. Typed via the `AppEventMap` generic so
 * `emit('project.created', payload)` type-checks the payload against the
 * map. The bus instance is pinned to `globalThis.__qablyBus` so it survives
 * HMR module reloads — the same singleton is reused across re-imports.
 */
import { EventEmitter } from 'node:events'
import type { AppEventMap } from './types/events'

type Key = keyof AppEventMap
type Listener<K extends Key> = (payload: AppEventMap[K]) => void

class TypedBus {
  private emitter = new EventEmitter()

  on<K extends Key>(event: K, listener: Listener<K>): () => void {
    this.emitter.on(event, listener)
    return () => this.emitter.off(event, listener)
  }

  off<K extends Key>(event: K, listener: Listener<K>): void {
    this.emitter.off(event, listener)
  }

  emit<K extends Key>(event: K, payload: AppEventMap[K]): void {
    this.emitter.emit(event, payload)
  }
}

const g = globalThis as unknown as { __qablyBus?: TypedBus }
export const eventBus: TypedBus = g.__qablyBus ?? (g.__qablyBus = new TypedBus())
