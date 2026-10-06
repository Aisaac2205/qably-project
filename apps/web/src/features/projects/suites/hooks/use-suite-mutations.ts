'use client'

import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Suite } from '@qably/types'
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
import { suiteKeys } from '../../lib/query-keys'
import {
  adoptSuite,
  evictSuiteDetail,
  invalidateSuiteList,
  markProjectStale,
  patchSuiteList,
} from '../lib/suite-cache'
import { invalidateSuiteSummaries, removeFromSuiteSummaries } from '../lib/suite-summaries-cache'
import { ApiError } from '@/lib/api-client'
import { markCiRunsStale } from '@/features/runs/lib/mark-ci-runs-stale'
import { markRunDetailsStale } from '@/features/runs/lib/mark-run-details-stale'
import { markRunPagesStale } from '@/features/runs/lib/mark-run-pages-stale'
import { notify } from '@/lib/notify'
import { useTranslation } from '@/lib/i18n'

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
      removeFromSuiteSummaries(queryClient, projectId, id)
      evictSuiteDetail(queryClient, id)
      void invalidateSuiteList(queryClient, projectId)
      void invalidateSuiteSummaries(queryClient, projectId)
      markProjectStale(queryClient, projectId)
      markRunDetailsStale(queryClient)
      markRunPagesStale(queryClient, projectId)
      markCiRunsStale(queryClient, projectId)
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
