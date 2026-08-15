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
  Connection,
  ExtractedProposal,
  Evidence,
  TraceabilityLink,
} from '@qably/types'

function useStableArray<T>(selector: () => T[], fallback: () => T[]): T[] {
  const cacheRef = useRef<{ key: number; value: T[] }>({ key: -1, value: [] })
  const serverCacheRef = useRef<T[] | null>(null)
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
    () => {
      const arr = fallback()
      if (serverCacheRef.current === null || !sameContents(serverCacheRef.current, arr)) {
        serverCacheRef.current = arr
      }
      return serverCacheRef.current
    },
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
  return useStableArray(() => getSnapshot().projects, () => getServerSnapshot().projects)
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
    () => getServerSnapshot().projects.find((p) => p.id === id),
  )
}

export function useSuites(projectId?: string): Suite[] {
  return useStableArray(
    () => {
      const all = getSnapshot().suites
      return projectId ? all.filter((s) => s.projectId === projectId) : all
    },
    () => getServerSnapshot().suites.filter((s) => !projectId || s.projectId === projectId),
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
    () => getServerSnapshot().suites.find((s) => s.id === suiteId),
  )
}

export function useRuns(projectId?: string): Run[] {
  return useStableArray(
    () => {
      const all = getSnapshot().runs
      return projectId ? all.filter((r) => r.projectId === projectId) : all
    },
    () => getServerSnapshot().runs.filter((r) => !projectId || r.projectId === projectId),
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
    () => getServerSnapshot().runs.find((r) => r.id === runId),
  )
}

export function useAiCases(projectId?: string): AiCase[] {
  return useStableArray(
    () => {
      const all = getSnapshot().aiCases
      return projectId ? all.filter((c) => c.projectId === projectId) : all
    },
    () => getServerSnapshot().aiCases.filter((c) => !projectId || c.projectId === projectId),
  )
}

export function useOrg(): Organization {
  return useSyncExternalStore(subscribe, () => getSnapshot().org, () => getServerSnapshot().org)
}

export function useMembers(): OrgMember[] {
  return useStableArray(() => getSnapshot().members, () => getServerSnapshot().members)
}

export function useApiKeys(): ApiKey[] {
  return useStableArray(() => getSnapshot().apiKeys, () => getServerSnapshot().apiKeys)
}

export function useIntegration(): GithubIntegration {
  return useSyncExternalStore(subscribe, () => getSnapshot().integration, () => getServerSnapshot().integration)
}

export function useAiProviders(): AiProviderConnection[] {
  return useStableArray(() => getSnapshot().aiProviders, () => getServerSnapshot().aiProviders)
}

export function useChatMessages(projectId: string): ChatMessage[] {
  const threadId = getChatThread(projectId).id
  return useStableArray(
    () => getSnapshot().chatMessages.filter((m) => m.threadId === threadId),
    () => getServerSnapshot().chatMessages.filter((m) => m.threadId === threadId),
  )
}

export function useCoverageGaps(projectId?: string): CoverageGap[] {
  return useStableArray(
    () => {
      const all = getSnapshot().coverageGaps
      return projectId ? all.filter((g) => g.projectId === projectId) : all
    },
    () => getServerSnapshot().coverageGaps.filter((g) => !projectId || g.projectId === projectId),
  )
}

export function useConnections(): Connection[] {
  return useStableArray(() => getSnapshot().connections, () => getServerSnapshot().connections)
}

export function useProposal(id: string): ExtractedProposal | undefined {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot().proposals.find((proposal) => proposal.id === id),
    () => getServerSnapshot().proposals.find((proposal) => proposal.id === id),
  )
}

export function useProposalForAiReviewCase(caseId: string): ExtractedProposal | undefined {
  return useSyncExternalStore(
    subscribe,
    () => {
      const proposalId = getSnapshot().proposalIdByAiCaseId[caseId]
      return proposalId ? getSnapshot().proposals.find((proposal) => proposal.id === proposalId) : undefined
    },
    () => {
      const snapshot = getServerSnapshot()
      const proposalId = snapshot.proposalIdByAiCaseId[caseId]
      return proposalId ? snapshot.proposals.find((proposal) => proposal.id === proposalId) : undefined
    },
  )
}

export function useEvidence(id?: string): Evidence | undefined {
  return useSyncExternalStore(
    subscribe,
    () => id ? getSnapshot().evidence.find((item) => item.id === id) : undefined,
    () => id ? getServerSnapshot().evidence.find((item) => item.id === id) : undefined,
  )
}

export function useTraceabilityLinks(entityId: string): TraceabilityLink[] {
  return useStableArray(
    () => getSnapshot().traceabilityLinks.filter((link) => link.from.id === entityId || link.to.id === entityId),
    () => getServerSnapshot().traceabilityLinks.filter((link) => link.from.id === entityId || link.to.id === entityId),
  )
}

export function useConnection(id: string): Connection | undefined {
  const cacheRef = useRef<{ id: string; value: Connection | undefined }>({ id: '', value: undefined })
  return useSyncExternalStore(
    subscribe,
    () => {
      const c = getSnapshot().connections.find((c) => c.id === id)
      if (c !== cacheRef.current.value || id !== cacheRef.current.id) {
        cacheRef.current = { id, value: c }
      }
      return cacheRef.current.value
    },
    () => getServerSnapshot().connections.find((connection) => connection.id === id),
  )
}
