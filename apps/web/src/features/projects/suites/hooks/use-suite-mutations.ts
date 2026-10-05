'use client'

import { useCallback } from 'react'
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { Project, Suite } from '@qably/types'
import {
  confirmDocumentation,
  createCase,
  createSuite,
  deleteCase,
  deleteSuite,
  documentCase,
  documentSuite,
  type DocumentFilesMode,
  updateCase,
  updateSuite,
  type CreateCasePayload,
  type CreateSuitePayload,
  type UpdateCasePayload,
  type UpdateSuitePayload,
} from '../api/suites.api'
import { projectKeys, suiteKeys } from '../../lib/query-keys'
import { ApiError } from '@/lib/api-client'
import { markRunDetailsStale } from '@/features/runs/lib/mark-run-details-stale'
import { markRunPagesStale } from '@/features/runs/lib/mark-run-pages-stale'
import { notify } from '@/lib/notify'
import { useTranslation } from '@/lib/i18n'

function patchSuiteList(queryClient: QueryClient, fresh: Suite) {
  const listKey = suiteKeys.list(fresh.projectId)
  const cached = queryClient.getQueryData<Suite[]>(listKey)

  if (cached === undefined) return

  const known = cached.some((entry) => entry.id === fresh.id)
  const merged = known
    ? cached.map((entry) => (entry.id === fresh.id ? fresh : entry))
    : [fresh, ...cached]
  const demotedIds = new Set(
    fresh.isDefault
      ? merged.filter((entry) => entry.id !== fresh.id && entry.isDefault).map((entry) => entry.id)
      : [],
  )

  queryClient.setQueryData<Suite[]>(
    listKey,
    demotedIds.size === 0
      ? merged
      : merged.map((entry) => (demotedIds.has(entry.id) ? { ...entry, isDefault: false } : entry)),
  )

  for (const id of demotedIds) {
    void queryClient.invalidateQueries({ queryKey: suiteKeys.detail(id), refetchType: 'none' })
  }
}

function invalidateSuiteList(queryClient: QueryClient, projectId: string) {
  return queryClient.invalidateQueries({ queryKey: suiteKeys.list(projectId) })
}

function markProjectStale(queryClient: QueryClient, projectId: string) {
  void queryClient.invalidateQueries({
    queryKey: projectKeys.detail(projectId),
    refetchType: 'none',
  })
}

function reflectManualCases(queryClient: QueryClient, suite: Suite) {
  const hasActiveManualCase = suite.cases.some(
    (entry) => entry.executionMode === 'manual' && entry.state === 'active',
  )

  if (!hasActiveManualCase) return

  queryClient.setQueryData<Project>(projectKeys.detail(suite.projectId), (cached) =>
    cached === undefined || cached.hasManualCases === true
      ? undefined
      : { ...cached, hasManualCases: true },
  )
}

async function adoptSuite(queryClient: QueryClient, suite: Suite) {
  const detailKey = suiteKeys.detail(suite.id)

  await queryClient.cancelQueries({ queryKey: detailKey, exact: true })
  queryClient.setQueryData(detailKey, suite)
  patchSuiteList(queryClient, suite)
  reflectManualCases(queryClient, suite)
  void invalidateSuiteList(queryClient, suite.projectId)
}

function evictSuiteDetail(queryClient: QueryClient, suiteId: string) {
  const cache = queryClient.getQueryCache()
  const filters = { queryKey: suiteKeys.detail(suiteId), exact: true }
  const query = cache.find(filters)

  if (query === undefined) return

  if (query.getObserversCount() === 0) {
    queryClient.removeQueries(filters)
    return
  }

  const unsubscribe = cache.subscribe((event) => {
    if (event.type !== 'observerRemoved' || event.query !== query) return
    if (query.getObserversCount() > 0) return

    unsubscribe()
    queryClient.removeQueries(filters)
  })
}

export function useRefreshSuiteLists() {
  const queryClient = useQueryClient()

  return useCallback(
    async (projectId: string, suiteId: string) => {
      const fresh = queryClient.getQueryData<Suite>(suiteKeys.detail(suiteId))

      if (fresh !== undefined) patchSuiteList(queryClient, fresh)

      await invalidateSuiteList(queryClient, projectId)
    },
    [queryClient],
  )
}

function useCaseSync() {
  const queryClient = useQueryClient()

  return async (suite: Suite) => {
    await adoptSuite(queryClient, suite)
    markProjectStale(queryClient, suite.projectId)
    markRunDetailsStale(queryClient)
  }
}

export function useCreateSuite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateSuitePayload) => createSuite(payload),
    onSuccess: (suite) => adoptSuite(queryClient, suite),
  })
}

export function useUpdateSuite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateSuitePayload }) =>
      updateSuite(id, patch),
    onSuccess: async (suite) => {
      markRunDetailsStale(queryClient)
      await adoptSuite(queryClient, suite)
    },
  })
}

export function useDeleteSuite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) => deleteSuite(id),
    onSuccess: (_result, { id, projectId }) => {
      queryClient.setQueryData<Suite[]>(suiteKeys.list(projectId), (cached) =>
        cached?.filter((entry) => entry.id !== id),
      )
      evictSuiteDetail(queryClient, id)
      void invalidateSuiteList(queryClient, projectId)
      markProjectStale(queryClient, projectId)
      markRunDetailsStale(queryClient)
      markRunPagesStale(queryClient, projectId)
    },
  })
}

export function useCreateCase() {
  const syncCase = useCaseSync()

  return useMutation({
    mutationFn: ({
      suiteId,
      payload,
    }: {
      suiteId: string
      payload: CreateCasePayload
    }) => createCase(suiteId, payload),
    onSuccess: syncCase,
  })
}

export function useUpdateCase() {
  const syncCase = useCaseSync()

  return useMutation({
    mutationFn: ({
      suiteId,
      caseId,
      patch,
    }: {
      suiteId: string
      caseId: string
      patch: UpdateCasePayload
    }) => updateCase(suiteId, caseId, patch),
    onSuccess: syncCase,
  })
}

export function useDeleteCase() {
  const syncCase = useCaseSync()

  return useMutation({
    mutationFn: ({ suiteId, caseId }: { suiteId: string; caseId: string }) =>
      deleteCase(suiteId, caseId),
    onSuccess: syncCase,
  })
}

export function useDocumentSuite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      suiteId,
      mode,
    }: {
      suiteId: string
      projectId: string
      mode: DocumentFilesMode
    }) => documentSuite(suiteId, mode),
    onSuccess: async (_result, { suiteId, projectId }) => {
      void queryClient.invalidateQueries({
        queryKey: suiteKeys.list(projectId),
        refetchType: 'none',
      })
      await queryClient.invalidateQueries({ queryKey: suiteKeys.detail(suiteId) })
    },
  })
}

export function useConfirmDocumentation() {
  const refreshSuiteLists = useRefreshSuiteLists()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      suiteId,
      caseIds,
    }: {
      suiteId: string
      projectId: string
      caseIds?: string[]
    }) => confirmDocumentation(suiteId, caseIds),
    onSuccess: async (_result, { suiteId, projectId }) => {
      await queryClient.invalidateQueries({ queryKey: suiteKeys.detail(suiteId) })
      void refreshSuiteLists(projectId, suiteId)
      markProjectStale(queryClient, projectId)
      markRunDetailsStale(queryClient)
    },
  })
}

export function useDocumentCase() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ suiteId, caseId }: { suiteId: string; caseId: string }) =>
      documentCase(suiteId, caseId),
    onSuccess: async (_result, { suiteId }) => {
      markRunDetailsStale(queryClient)
      await queryClient.invalidateQueries({ queryKey: suiteKeys.detail(suiteId) })
      notify.success(t('suites.documentCaseQueued'))
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError && error.code === 'no-source-file') {
        notify.error(t('suites.documentCaseNoSourceFile'))
        return
      }
      if (error instanceof ApiError && error.code === 'ai-not-enabled') {
        notify.error(t('reviewInbox.manualReviewReasonAiNotEnabled'))
        return
      }
      notify.error(t('suites.documentFilesError'))
    },
  })
}
