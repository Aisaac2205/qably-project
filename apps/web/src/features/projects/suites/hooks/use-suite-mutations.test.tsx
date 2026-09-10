import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Suite } from '@qably/types'
import {
  useCreateCase,
  useDeleteCase,
  useUpdateCase,
} from './use-suite-mutations'
import { createCase, deleteCase, updateCase } from '../api/suites.api'
import { projectKeys, suiteKeys } from '../../lib/query-keys'

vi.mock('../api/suites.api', () => ({
  createCase: vi.fn(),
  updateCase: vi.fn(),
  deleteCase: vi.fn(),
}))

const create = vi.mocked(createCase)
const update = vi.mocked(updateCase)
const remove = vi.mocked(deleteCase)

const suite: Suite = {
  id: 'suite-1',
  projectId: 'proj-1',
  organizationId: 'org-1',
  name: 'Checkout',
  cases: [],
  manualCases: 1,
  automatedCases: 0,
  staleLocaleCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  description: '',
  tags: [],
  isDefault: false,
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
  return { client, invalidateSpy }
}

beforeEach(() => {
  vi.clearAllMocks()
  create.mockResolvedValue(suite)
  update.mockResolvedValue(suite)
  remove.mockResolvedValue(suite)
})

describe('useCreateCase', () => {
  it('invalidates the project detail so hasManualCases reflects the new case', async () => {
    const { client, invalidateSpy } = setup()
    const { result } = renderHook(() => useCreateCase(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })

    result.current.mutate({ suiteId: 'suite-1', payload: { name: 'New case' } })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: projectKeys.detail('proj-1'),
      })
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: suiteKeys.all })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: suiteKeys.detail('suite-1'),
    })
  })
})

describe('useUpdateCase', () => {
  it('invalidates the project detail so hasManualCases reflects an executionMode change', async () => {
    const { client, invalidateSpy } = setup()
    const { result } = renderHook(() => useUpdateCase(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })

    result.current.mutate({
      suiteId: 'suite-1',
      caseId: 'case-1',
      patch: { state: 'active' },
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: projectKeys.detail('proj-1'),
      })
    })
  })
})

describe('useDeleteCase', () => {
  it('invalidates the project detail so hasManualCases reflects the removed case', async () => {
    const { client, invalidateSpy } = setup()
    const { result } = renderHook(() => useDeleteCase(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })

    result.current.mutate({ suiteId: 'suite-1', caseId: 'case-1' })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: projectKeys.detail('proj-1'),
      })
    })
  })
})
