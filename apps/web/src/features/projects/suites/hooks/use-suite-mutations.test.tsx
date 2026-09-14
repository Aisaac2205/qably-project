import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Suite } from '@qably/types'
import {
  useConfirmDocumentation,
  useCreateCase,
  useDeleteCase,
  useDocumentCase,
  useUpdateCase,
} from './use-suite-mutations'
import {
  confirmDocumentation,
  createCase,
  deleteCase,
  documentCase,
  updateCase,
} from '../api/suites.api'
import { projectKeys, suiteKeys } from '../../lib/query-keys'
import { ApiError } from '@/lib/api-client'
import { notify } from '@/lib/notify'

vi.mock('../api/suites.api', () => ({
  createCase: vi.fn(),
  updateCase: vi.fn(),
  deleteCase: vi.fn(),
  confirmDocumentation: vi.fn(),
  documentCase: vi.fn(),
}))

vi.mock('@/lib/notify', () => ({
  notify: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}))

const create = vi.mocked(createCase)
const update = vi.mocked(updateCase)
const remove = vi.mocked(deleteCase)
const confirm = vi.mocked(confirmDocumentation)
const document_ = vi.mocked(documentCase)

const suite: Suite = {
  id: 'suite-1',
  projectId: 'proj-1',
  organizationId: 'org-1',
  name: 'Checkout',
  cases: [],
  manualCases: 1,
  automatedCases: 0,
  undocumentedCount: 0,
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
  confirm.mockResolvedValue({
    suiteId: 'suite-1',
    confirmedCaseIds: ['case-1'],
    confirmedCount: 1,
    skippedCaseIds: [],
    skippedCount: 0,
    documentationConfirmedAt: '2026-09-12T10:00:00.000Z',
    documentationConfirmedById: 'user-1',
  })
  document_.mockResolvedValue({ queued: true, jobId: 'job-1' })
})

describe('useConfirmDocumentation', () => {
  it('refreshes the suite in place so the confirmed cases stop reading as drafts', async () => {
    const { client, invalidateSpy } = setup()
    const { result } = renderHook(() => useConfirmDocumentation(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })

    result.current.mutate({ suiteId: 'suite-1', projectId: 'proj-1' })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: suiteKeys.detail('suite-1'),
      })
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: projectKeys.detail('proj-1'),
    })
    expect(confirm).toHaveBeenCalledWith('suite-1')
  })
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

describe('useDocumentCase', () => {
  it('queues the case and notifies success', async () => {
    const { client } = setup()
    const { result } = renderHook(() => useDocumentCase(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })

    result.current.mutate({ suiteId: 'suite-1', caseId: 'case-1' })

    await waitFor(() => {
      expect(document_).toHaveBeenCalledWith('suite-1', 'case-1')
    })
    await waitFor(() => {
      expect(notify.success).toHaveBeenCalledWith('Aeris is documenting this case.')
    })
  })

  it('shows the no-source-file message for a 409 with that code', async () => {
    document_.mockRejectedValueOnce(new ApiError(409, 'nope', 'no-source-file'))
    const { client } = setup()
    const { result } = renderHook(() => useDocumentCase(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })

    result.current.mutate({ suiteId: 'suite-1', caseId: 'case-1' })

    await waitFor(() => {
      expect(notify.error).toHaveBeenCalledWith(
        "Aeris has not identified this case's test file yet.",
      )
    })
  })

  it('shows the AI-not-enabled message for a 403 with that code', async () => {
    document_.mockRejectedValueOnce(new ApiError(403, 'nope', 'ai-not-enabled'))
    const { client } = setup()
    const { result } = renderHook(() => useDocumentCase(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })

    result.current.mutate({ suiteId: 'suite-1', caseId: 'case-1' })

    await waitFor(() => {
      expect(notify.error).toHaveBeenCalledWith(
        'AI extraction is not enabled for this organization.',
      )
    })
  })

  it('shows a generic error message for any other failure', async () => {
    document_.mockRejectedValueOnce(new Error('boom'))
    const { client } = setup()
    const { result } = renderHook(() => useDocumentCase(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })

    result.current.mutate({ suiteId: 'suite-1', caseId: 'case-1' })

    await waitFor(() => {
      expect(notify.error).toHaveBeenCalledWith('Could not queue this documentation. Try again.')
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
