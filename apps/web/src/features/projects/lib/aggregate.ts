/**
 * useProjectAggregate — transactional aggregate hook for the projects module.
 *
 * Wraps the mock-store CRUD (`createProject`, `updateProject`, `deleteProject`)
 * with bus emissions on `@/lib/event-bus`, so cross-module subscribers
 * (notifications, integrations) can react to project lifecycle events
 * without coupling to mock-store internals.
 *
 * Architectural invariants:
 * - The aggregate is the ONLY surface other modules use to mutate projects.
 *   Direct `mockStore` mutations from outside `features/projects/` are NOT
 *   permitted (per REQ-PROJ-005).
 * - `transition` is intentionally absent — projects have no state machine.
 *   State-machine aggregates (runs, integrations, billing) get the
 *   `transition` key; this one does not.
 * - Reads use `useProjects()` from `@/lib/use-mock-store` which is
 *   `useSyncExternalStore`-backed — re-renders on every store mutation.
 */
'use client'

import { useCallback, useMemo } from 'react'
import {
  createProject as _createProject,
  updateProject as _updateProject,
  deleteProject as _deleteProject,
  getProject as _getProject,
} from '@/lib/mock-store'
import { useProjects } from '@/lib/use-mock-store'
import { eventBus } from '@/lib/event-bus'
import type { Project } from '@qably/types'

export type ProjectInput = {
  name: string
  description?: string
  githubRepo?: string
  technologies?: string[]
}

export type ProjectPatch = Partial<
  Pick<Project, 'name' | 'description' | 'githubRepo' | 'technologies'>
>

export interface ProjectAggregate {
  /** All projects, live (re-renders on store changes). */
  projects: Project[]
  /** Look up a project by id; returns undefined if missing. */
  project: (id: string) => Project | undefined
  /** Create a project and emit `project.created`. */
  create: (input: ProjectInput) => Project
  /** Update a project and emit `project.updated`. Returns undefined if id is missing. */
  update: (id: string, patch: ProjectPatch) => Project | undefined
  /** Delete a project. Returns true on success, false if id is missing. */
  delete: (id: string) => boolean
  // transition is intentionally absent — projects have no state machine.
}

export function useProjectAggregate(): ProjectAggregate {
  const projects = useProjects()

  const project = useCallback((id: string) => _getProject(id), [])

  const create = useCallback((input: ProjectInput): Project => {
    const created = _createProject(input)
    eventBus.emit('project.created', { projectId: created.id })
    return created
  }, [])

  const update = useCallback(
    (id: string, patch: ProjectPatch): Project | undefined => {
      const updated = _updateProject(id, patch)
      if (updated) {
        eventBus.emit('project.updated', { projectId: id })
      }
      return updated
    },
    [],
  )

  const deleteFn = useCallback((id: string): boolean => _deleteProject(id), [])

  return useMemo(
    () => ({ projects, project, create, update, delete: deleteFn }),
    [projects, project, create, update, deleteFn],
  )
}
