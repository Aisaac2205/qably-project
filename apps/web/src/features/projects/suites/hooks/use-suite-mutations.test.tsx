import type { ReactNode } from 'react'
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
import { useSuites } from './use-suites'
import {
  confirmDocumentation,
  createCase,
  deleteCase,
  documentCase,
  listSuites,
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
  listSuites: vi.fn(),
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
const list = vi.mocked(listSuites)

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
  incompleteCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  description: '',
  tags: [],
  isDefault: false,
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const otherSuite: Suite = { ...suite, id: 'suite-2', name: 'Login' }

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidateSpy = vi.spyOn(client, 'invalidateQueries')
  return { client, invalidateSpy }
}

function wrapperFor(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

async function cacheInactiveList(client: QueryClient, projectId: string, entries: Suite[]) {
  list.mockResolvedValueOnce(entries)
  const observed = renderHook(() => useSuites(projectId), { wrapper: wrapperFor(client) })

  await waitFor(() => {
    expect(observed.result.current.suites).toHaveLength(entries.length)
  })
  observed.unmount()
}

beforeEach(() => {
  vi.clearAllMocks()
  list.mockReset()
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
    expect(confirm).toHaveBeenCalledWith('suite-1', undefined)
  })

  it('refetches the project suite list even when no screen is observing it', async () => {
    const { client } = setup()
    await cacheInactiveList(client, 'proj-1', [suite, otherSuite])
    list.mockResolvedValue([{ ...suite, name: 'Checkout flow' }, otherSuite])
    const { result } = renderHook(() => useConfirmDocumentation(), {
      wrapper: wrapperFor(client),
    })

    result.current.mutate({ suiteId: 'suite-1', projectId: 'proj-1' })

    await waitFor(() => {
      expect(client.getQueryData<Suite[]>(suiteKeys.list('proj-1'))?.[0].name).toBe(
        'Checkout flow',
      )
    })
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('shows the confirmed suite in the cached list before the list refetch lands', async () => {
    const { client } = setup()
    await cacheInactiveList(client, 'proj-1', [suite, otherSuite])
    list.mockReturnValue(new Promise(() => {}))
    client.setQueryData(suiteKeys.detail('suite-1'), { ...suite, name: 'Checkout flow' })
    const { result } = renderHook(() => useConfirmDocumentation(), {
      wrapper: wrapperFor(client),
    })

    result.current.mutate({ suiteId: 'suite-1', projectId: 'proj-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(
      client.getQueryData<Suite[]>(suiteKeys.list('proj-1'))?.map((entry) => entry.name),
    ).toEqual(['Checkout flow', 'Login'])
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('leaves the suite list of another project untouched', async () => {
    const { client } = setup()
    await cacheInactiveList(client, 'proj-1', [suite])
    await cacheInactiveList(client, 'proj-2', [{ ...otherSuite, projectId: 'proj-2' }])
    list.mockResolvedValue([suite])
    const { result } = renderHook(() => useConfirmDocumentation(), {
      wrapper: wrapperFor(client),
    })

    result.current.mutate({ suiteId: 'suite-1', projectId: 'proj-1' })

    await waitFor(() => {
      expect(list).toHaveBeenCalledTimes(3)
    })
    expect(list.mock.calls.filter(([projectId]) => projectId === 'proj-2')).toHaveLength(1)
  })

  it('forwards the selected case ids to the API call', async () => {
    const { client } = setup()
    const { result } = renderHook(() => useConfirmDocumentation(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })

    result.current.mutate({
      suiteId: 'suite-1',
      projectId: 'proj-1',
      caseIds: ['case-1', 'case-2'],
    })

    await waitFor(() => {
      expect(confirm).toHaveBeenCalledWith('suite-1', ['case-1', 'case-2'])
    })
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
