/**
 * React 19 hooks wrapping getSnapshot/subscribe from mock-store
 * via useSyncExternalStore.
 *
 * Each hook provides a stable server snapshot for SSR safety.
 */
'use client'

import { useSyncExternalStore } from 'react'
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

export function useProjects(): Project[] {
  return useSyncExternalStore(subscribe, () => getSnapshot().projects, () => getServerSnapshot().projects)
}

export function useProject(id: string): Project | undefined {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot().projects.find((p) => p.id === id),
    () => getServerSnapshot().projects.find((p) => p.id === id),
  )
}

export function useSuites(projectId?: string): Suite[] {
  return useSyncExternalStore(
    subscribe,
    () => {
      const all = getSnapshot().suites
      return projectId ? all.filter((s) => s.projectId === projectId) : all
    },
    () => [],
  )
}

export function useSuite(suiteId: string): Suite | undefined {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot().suites.find((s) => s.id === suiteId),
    () => undefined,
  )
}

export function useRuns(projectId?: string): Run[] {
  return useSyncExternalStore(
    subscribe,
    () => {
      const all = getSnapshot().runs
      return projectId ? all.filter((r) => r.projectId === projectId) : all
    },
    () => [],
  )
}

export function useRun(runId: string): Run | undefined {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot().runs.find((r) => r.id === runId),
    () => undefined,
  )
}

export function useAiCases(projectId?: string): AiCase[] {
  return useSyncExternalStore(
    subscribe,
    () => {
      const all = getSnapshot().aiCases
      return projectId ? all.filter((c) => c.projectId === projectId) : all
    },
    () => [],
  )
}

export function usePipelines(projectId?: string): PipelineRun[] {
  return useSyncExternalStore(
    subscribe,
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
  return useSyncExternalStore(subscribe, () => getSnapshot().members, () => getServerSnapshot().members)
}

export function useApiKeys(): ApiKey[] {
  return useSyncExternalStore(subscribe, () => getSnapshot().apiKeys, () => getServerSnapshot().apiKeys)
}

export function useIntegration(): GithubIntegration {
  return useSyncExternalStore(subscribe, () => getSnapshot().integration, () => getServerSnapshot().integration)
}
