'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Suite } from '@qably/types'
import {
  createCase,
  createSuite,
  deleteCase,
  deleteSuite,
  documentCase,
  updateCase,
  updateSuite,
  type CreateCasePayload,
  type CreateSuitePayload,
  type UpdateCasePayload,
  type UpdateSuitePayload,
} from '../api/suites.api'
import { projectKeys, suiteKeys } from '../../lib/query-keys'

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

export function useDocumentCase() {
  return useMutation({
    mutationFn: ({ suiteId, caseId }: { suiteId: string; caseId: string }) =>
      documentCase(suiteId, caseId),
  })
}
