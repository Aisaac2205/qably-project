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
  getChatThread,
} from '@/lib/mock-store'
import type {
  Project,
  Suite,
  Run,
  AiCase,
  Organization,
  OrgMember,
  ApiKey,
  GithubIntegration,
  AiProviderConnection,
  ChatMessage,
  CoverageGap,
} from '@qably/types'

// Module-level frozen empty arrays — stable identity across SSR calls.
// React 19's useSyncExternalStore requires getServerSnapshot to return
// the SAME reference on every call to prevent infinite loop detection.
const EMPTY_PROJECTS = Object.freeze([]) as unknown as Project[]
const EMPTY_SUITES = Object.freeze([]) as unknown as Suite[]
const EMPTY_RUNS = Object.freeze([]) as unknown as Run[]
const EMPTY_AI_CASES = Object.freeze([]) as unknown as AiCase[]
const EMPTY_MEMBERS = Object.freeze([]) as unknown as OrgMember[]
const EMPTY_API_KEYS = Object.freeze([]) as unknown as ApiKey[]
const EMPTY_AI_PROVIDERS = Object.freeze([]) as unknown as AiProviderConnection[]
const EMPTY_CHAT_MESSAGES = Object.freeze([]) as unknown as ChatMessage[]
const EMPTY_COVERAGE_GAPS = Object.freeze([]) as unknown as CoverageGap[]

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
  return useStableArray(() => getSnapshot().projects, () => EMPTY_PROJECTS)
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
    () => EMPTY_SUITES,
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
    () => EMPTY_RUNS,
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
    () => EMPTY_AI_CASES,
  )
}

export function useOrg(): Organization {
  return useSyncExternalStore(subscribe, () => getSnapshot().org, () => getServerSnapshot().org)
}

export function useMembers(): OrgMember[] {
  return useStableArray(() => getSnapshot().members, () => EMPTY_MEMBERS)
}

export function useApiKeys(): ApiKey[] {
  return useStableArray(() => getSnapshot().apiKeys, () => EMPTY_API_KEYS)
}

export function useIntegration(): GithubIntegration {
  return useSyncExternalStore(subscribe, () => getSnapshot().integration, () => getServerSnapshot().integration)
}

export function useAiProviders(): AiProviderConnection[] {
  return useStableArray(() => getSnapshot().aiProviders, () => EMPTY_AI_PROVIDERS)
}

export function useChatMessages(projectId: string): ChatMessage[] {
  const threadId = getChatThread(projectId).id
  return useStableArray(
    () => getSnapshot().chatMessages.filter((m) => m.threadId === threadId),
    () => EMPTY_CHAT_MESSAGES,
  )
}

export function useCoverageGaps(projectId?: string): CoverageGap[] {
  return useStableArray(
    () => {
      const all = getSnapshot().coverageGaps
      return projectId ? all.filter((g) => g.projectId === projectId) : all
    },
    () => EMPTY_COVERAGE_GAPS,
  )
}
