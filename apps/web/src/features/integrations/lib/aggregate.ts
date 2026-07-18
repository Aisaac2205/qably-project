/**
 * useConnections — transactional aggregate hook for the integrations module.
 *
 * Wraps mock-store CRUD with bus emissions on `@/lib/event-bus` so
 * cross-module subscribers (notifications, runs) can react to connection
 * lifecycle events without coupling to mock-store internals.
 *
 * Architectural invariants:
 * - The aggregate is the ONLY surface other modules use to mutate
 *   connections (REQ-INTEG-005 boundary).
 * - State machine: pending → connected → disconnected, driven by
 *   `transition('connect' | 'disconnect')`. Invalid transitions return
 *   undefined and emit nothing.
 * - `create` and `update` emit nothing; only `transition` emits
 *   `connection.added` / `connection.removed` (matches the AppEventMap).
 */
'use client'

import { useCallback, useMemo } from 'react'
import {
  getConnections as _getConnections,
  getConnection as _getConnection,
  createConnection as _createConnection,
  updateConnection as _updateConnection,
  deleteConnection as _deleteConnection,
  transitionConnection as _transitionConnection,
  subscribe,
  getSnapshot,
  getServerSnapshot,
} from '@/lib/mock-store'
import { useSyncExternalStore } from 'react'
import { eventBus } from '@/lib/event-bus'
import type { Connection, ConnectionType } from '@qably/types'

const EMPTY = Object.freeze([]) as unknown as Connection[]

export type ConnectionInput = {
  type: ConnectionType
  name: string
  config?: Record<string, string>
}

export type ConnectionPatch = Partial<Pick<Connection, 'name' | 'config' | 'lastSyncAt'>>

export type ConnectionAction = 'connect' | 'disconnect'

export interface ConnectionAggregate {
  connections: Connection[]
  connection: (id: string) => Connection | undefined
  create: (input: ConnectionInput) => Connection
  update: (id: string, patch: ConnectionPatch) => Connection | undefined
  delete: (id: string) => boolean
  /**
   * State machine action. Valid transitions:
   *   pending      → connect    → connected
   *   disconnected → connect    → connected
   *   connected    → disconnect → disconnected
   *   pending      → disconnect → disconnected
   * Anything else is a no-op (returns undefined; emits nothing).
   * On success emits `connection.added` (connect from non-connected)
   * or `connection.removed` (disconnect to non-pending).
   */
  transition: (id: string, action: ConnectionAction) => Connection | undefined
}

export function useConnections(): ConnectionAggregate {
  const connections = useSyncExternalStore(
    subscribe,
    () => getSnapshot().connections,
    () => (getServerSnapshot().connections as Connection[] | undefined) ?? EMPTY,
  )

  const connection = useCallback((id: string) => _getConnection(id), [])

  const create = useCallback((input: ConnectionInput): Connection => {
    return _createConnection(input)
  }, [])

  const update = useCallback(
    (id: string, patch: ConnectionPatch): Connection | undefined => {
      return _updateConnection(id, patch)
    },
    [],
  )

  const deleteFn = useCallback((id: string): boolean => {
    const existed = _getConnection(id) !== undefined
    const ok = _deleteConnection(id)
    if (ok && existed) {
      eventBus.emit('connection.removed', { connectionId: id })
    }
    return ok
  }, [])

  const transition = useCallback(
    (id: string, action: ConnectionAction): Connection | undefined => {
      const before = _getConnection(id)
      const updated = _transitionConnection(id, action)
      if (!updated || !before) return updated
      // Emit per the AppEventMap contract:
      //   `connection.added`   — connection enters a non-pending, non-disconnected state via connect
      //   `connection.removed` — connection is disconnected (moved to disconnected state)
      if (action === 'connect' && updated.status === 'connected') {
        eventBus.emit('connection.added', {
          connectionId: id,
          // Provider is the ConnectionType narrowed to CI providers
          provider: (updated.type === 'github' || updated.type === 'bitbucket' || updated.type === 'gitlab')
            ? updated.type
            : 'github',
        })
      } else if (action === 'disconnect' && updated.status === 'disconnected') {
        eventBus.emit('connection.removed', { connectionId: id })
      }
      return updated
    },
    [],
  )

  return useMemo(
    () => ({ connections, connection, create, update, delete: deleteFn, transition }),
    [connections, connection, create, update, deleteFn, transition],
  )
}
