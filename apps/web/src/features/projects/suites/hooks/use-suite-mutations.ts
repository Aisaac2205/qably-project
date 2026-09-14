'use client'

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
import { projectKeys, suiteKeys } from '../../lib/query-keys'
import { ApiError } from '@/lib/api-client'
import { notify } from '@/lib/notify'
import { useTranslation } from '@/lib/i18n'

function useSuiteInvalidation() {
  const queryClient = useQueryClient()

  return async (suite?: Suite) => {
    await queryClient.invalidateQueries({ queryKey: suiteKeys.all })
    if (suite !== undefined) {
      await queryClient.invalidateQueries({
        queryKey: suiteKeys.detail(suite.id),
      })
    }
  }
}

function useCaseInvalidation() {
  const invalidateSuites = useSuiteInvalidation()
  const queryClient = useQueryClient()

  return async (suite: Suite) => {
    await invalidateSuites(suite)
    await queryClient.invalidateQueries({
      queryKey: projectKeys.detail(suite.projectId),
    })
  }
}

export function useCreateSuite() {
  const invalidate = useSuiteInvalidation()

  return useMutation({
    mutationFn: (payload: CreateSuitePayload) => createSuite(payload),
    onSuccess: invalidate,
  })
}

export function useUpdateSuite() {
  const invalidate = useSuiteInvalidation()

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateSuitePayload }) =>
      updateSuite(id, patch),
    onSuccess: invalidate,
  })
}

export function useDeleteSuite() {
  const invalidate = useSuiteInvalidation()

  return useMutation({
    mutationFn: (id: string) => deleteSuite(id),
    onSuccess: () => invalidate(),
  })
}

export function useCreateCase() {
  const invalidate = useCaseInvalidation()

  return useMutation({
    mutationFn: ({
      suiteId,
      payload,
    }: {
      suiteId: string
      payload: CreateCasePayload
    }) => createCase(suiteId, payload),
    onSuccess: invalidate,
  })
}

export function useUpdateCase() {
  const invalidate = useCaseInvalidation()

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
    onSuccess: invalidate,
  })
}

export function useDeleteCase() {
  const invalidate = useCaseInvalidation()

  return useMutation({
    mutationFn: ({ suiteId, caseId }: { suiteId: string; caseId: string }) =>
      deleteCase(suiteId, caseId),
    onSuccess: invalidate,
  })
}

export function useDocumentSuite() {
  const invalidateSuites = useSuiteInvalidation()

  return useMutation({
    mutationFn: ({ suiteId, mode }: { suiteId: string; mode: DocumentFilesMode }) =>
      documentSuite(suiteId, mode),
    onSuccess: () => invalidateSuites(),
  })
}

export function useConfirmDocumentation() {
  const invalidateSuites = useSuiteInvalidation()
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
      await invalidateSuites()
      await queryClient.invalidateQueries({ queryKey: suiteKeys.detail(suiteId) })
      await queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
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
      await queryClient.invalidateQueries({ queryKey: suiteKeys.all })
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
