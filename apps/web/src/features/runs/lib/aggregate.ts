/**
 * useRunAggregate — transactional aggregate hook for the runs module.
 *
 * Wraps mock-store CRUD with bus emissions on `@/lib/event-bus` so
 * cross-module subscribers (notifications, billing) can react to run
 * lifecycle events without coupling to mock-store internals.
 *
 * Architectural invariants:
 * - The aggregate is the ONLY surface other modules use to mutate runs
 *   (REQ-RUN-005 boundary).
 * - State machine driven by `transition`:
 *     pending  → 'start'    → running
 *     running  → 'complete' → pass
 *     running  → 'fail'     → fail
 *   Invalid transitions return undefined and emit nothing.
 * - Emits `run.started` on 'start' and `run.completed` on 'complete' / 'fail'.
 *   Other mutations (create, update, delete) do not emit.
 * - Absorbed reports (Commit 3) are projections of runs — they read from
 *   the same source via the `useRunAggregate().runs` array. The reports
 *   UI in `features/runs/reports/` does NOT have its own aggregate.
 */
'use client'

import { useCallback, useMemo, useRef } from 'react'
import { useSyncExternalStore } from 'react'
import {
  getRuns as _getRuns,
  getRun as _getRun,
  createRun as _createRun,
  updateRun as _updateRun,
  deleteRun as _deleteRun,
  transitionRun as _transitionRun,
  subscribe,
  getSnapshot,
  getServerSnapshot,
} from '@/lib/mock-store'
import { eventBus } from '@/lib/event-bus'
import type { Run, RunSource, RunStatus } from '@qably/types'

const EMPTY = Object.freeze([]) as unknown as Run[]

// Stable identity cache for filtered/projectId-scoped runs — required
// by React 19's useSyncExternalStore (the getSnapshot must return the
// SAME reference on every call to avoid the "getSnapshot should be
// cached" infinite loop detection).
function useStableRuns(filter: (all: Run[]) => Run[]): Run[] {
  const cacheRef = useRef<{ key: string; value: Run[] }>({ key: '', value: EMPTY })
  return useSyncExternalStore(
    subscribe,
    () => {
      const next = filter(getSnapshot().runs)
      const key = `${next.length}:${next[0]?.id ?? ''}:${next[next.length - 1]?.id ?? ''}`
      if (key !== cacheRef.current.key || !sameRefs(cacheRef.current.value, next)) {
        cacheRef.current = { key, value: next }
      }
      return cacheRef.current.value
    },
    () => EMPTY,
  )
}

function sameRefs<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export type RunInput = {
  projectId: string
  suiteId: string
  name?: string
  source?: RunSource
}

export type RunPatch = Partial<
  Pick<Run, 'name' | 'status' | 'passRate' | 'finishedAt'>
>

export type RunAction = 'start' | 'complete' | 'fail'

export interface RunAggregate {
  runs: Run[]
  run: (id: string) => Run | undefined
  create: (input: RunInput) => Run
  update: (id: string, patch: RunPatch) => Run | undefined
  delete: (id: string) => boolean
  /**
   * State machine action. Valid transitions:
   *   pending → 'start'    → running  (emits run.started)
   *   running → 'complete' → pass     (emits run.completed, status='pass')
   *   running → 'fail'     → fail     (emits run.completed, status='fail')
   * Anything else is a no-op (returns undefined; emits nothing).
   */
  transition: (id: string, action: RunAction) => Run | undefined
}

export function useRunAggregate(projectId?: string): RunAggregate {
  const runs = useStableRuns((all) => {
    return projectId ? all.filter((r) => r.projectId === projectId) : all
  })

  const run = useCallback((id: string) => _getRun(id), [])

  const create = useCallback((input: RunInput): Run => {
    return _createRun(input)
  }, [])

  const update = useCallback(
    (id: string, patch: RunPatch): Run | undefined => _updateRun(id, patch),
    [],
  )

  const deleteFn = useCallback((id: string): boolean => _deleteRun(id), [])

  const transition = useCallback(
    (id: string, action: RunAction): Run | undefined => {
      const before = _getRun(id)
      const updated = _transitionRun(id, action)
      if (!updated || !before) return updated
      if (action === 'start') {
        eventBus.emit('run.started', {
          runId: id,
          projectId: updated.projectId,
          source: updated.source,
        })
      } else {
        // 'complete' → 'pass' or 'fail' → 'fail'
        eventBus.emit('run.completed', {
          runId: id,
          projectId: updated.projectId,
          status: updated.status as RunStatus,
          url: '', // Run type does not carry a URL field; reserved for future
        })
      }
      return updated
    },
    [],
  )

  return useMemo(
    () => ({ runs, run, create, update, delete: deleteFn, transition }),
    [runs, run, create, update, deleteFn, transition],
  )
}
