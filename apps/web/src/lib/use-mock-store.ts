/**
 * React 19 hooks wrapping getSnapshot/subscribe from mock-store
 * via useSyncExternalStore.
 *
 * Each hook provides a stable server snapshot for SSR safety.
 * Uses cached selectors to prevent infinite loops with React 19's strict getSnapshot identity checks.
 */
'use client'

import { useSyncExternalStore, useRef } from 'react'
import {
  subscribe,
  getSnapshot,
  getServerSnapshot,
} from '@/lib/mock-store'
import type {
  Project,
  Suite,
  Run,
  AiCase,
  PipelineRun,
  Organization,
  OrgMember,
  ApiKey,
  GithubIntegration,
} from '@qably/types'

function useStableArray<T>(selector: () => T[], fallback: () => T[]): T[] {
  const cacheRef = useRef<{ key: number; value: T[] }>({ key: -1, value: [] })
  return useSyncExternalStore(
    subscribe,
    () => {
      const arr = selector()
      const key = arr.length
      if (key !== cacheRef.current.key || !sameContents(cacheRef.current.value, arr)) {
        cacheRef.current = { key: arr.length, value: arr }
      }
      return cacheRef.current.value
    },
    fallback,
  )
}

function sameContents<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function useProjects(): Project[] {
  return useStableArray(() => getSnapshot().projects, () => [])
}

export function useProject(id: string): Project | undefined {
  const cacheRef = useRef<{ id: string; value: Project | undefined }>({ id: '', value: undefined })
  return useSyncExternalStore(
    subscribe,
    () => {
      const p = getSnapshot().projects.find((p) => p.id === id)
      if (p !== cacheRef.current.value || id !== cacheRef.current.id) {
        cacheRef.current = { id, value: p }
      }
      return cacheRef.current.value
    },
    () => undefined,
  )
}

export function useSuites(projectId?: string): Suite[] {
  return useStableArray(
    () => {
      const all = getSnapshot().suites
      return projectId ? all.filter((s) => s.projectId === projectId) : all
    },
    () => [],
  )
}

export function useSuite(suiteId: string): Suite | undefined {
  const cacheRef = useRef<{ id: string; value: Suite | undefined }>({ id: '', value: undefined })
  return useSyncExternalStore(
    subscribe,
    () => {
      const s = getSnapshot().suites.find((s) => s.id === suiteId)
      if (s !== cacheRef.current.value || suiteId !== cacheRef.current.id) {
        cacheRef.current = { id: suiteId, value: s }
      }
      return cacheRef.current.value
    },
    () => undefined,
  )
}

export function useRuns(projectId?: string): Run[] {
  return useStableArray(
    () => {
      const all = getSnapshot().runs
      return projectId ? all.filter((r) => r.projectId === projectId) : all
    },
    () => [],
  )
}

export function useRun(runId: string): Run | undefined {
  const cacheRef = useRef<{ id: string; value: Run | undefined }>({ id: '', value: undefined })
  return useSyncExternalStore(
    subscribe,
    () => {
      const r = getSnapshot().runs.find((r) => r.id === runId)
      if (r !== cacheRef.current.value || runId !== cacheRef.current.id) {
        cacheRef.current = { id: runId, value: r }
      }
      return cacheRef.current.value
    },
    () => undefined,
  )
}

export function useAiCases(projectId?: string): AiCase[] {
  return useStableArray(
    () => {
      const all = getSnapshot().aiCases
      return projectId ? all.filter((c) => c.projectId === projectId) : all
    },
    () => [],
  )
}

export function usePipelines(projectId?: string): PipelineRun[] {
  return useStableArray(
    () => {
      const all = getSnapshot().pipelines
      return projectId ? all.filter((p) => p.projectId === projectId) : all
    },
    () => [],
  )
}

export function useOrg(): Organization {
  return useSyncExternalStore(subscribe, () => getSnapshot().org, () => getServerSnapshot().org)
}

export function useMembers(): OrgMember[] {
  return useStableArray(() => getSnapshot().members, () => [])
}

export function useApiKeys(): ApiKey[] {
  return useStableArray(() => getSnapshot().apiKeys, () => [])
}

export function useIntegration(): GithubIntegration {
  return useSyncExternalStore(subscribe, () => getSnapshot().integration, () => getServerSnapshot().integration)
}
