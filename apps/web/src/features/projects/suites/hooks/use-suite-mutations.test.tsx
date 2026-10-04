import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, type UseMutationResult } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Suite } from '@qably/types'
import {
  useConfirmDocumentation,
  useCreateCase,
  useCreateSuite,
  useDeleteCase,
  useDeleteSuite,
  useDocumentCase,
  useDocumentSuite,
  useUpdateCase,
  useUpdateSuite,
} from './use-suite-mutations'
import { useSuite, useSuites } from './use-suites'
import {
  confirmDocumentation,
  createCase,
  createSuite,
  deleteCase,
  deleteSuite,
  documentCase,
  documentSuite,
  getSuite,
  listSuites,
  updateCase,
  updateSuite,
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
  getSuite: vi.fn(),
  createSuite: vi.fn(),
  updateSuite: vi.fn(),
  deleteSuite: vi.fn(),
  documentSuite: vi.fn(),
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
const getSuiteApi = vi.mocked(getSuite)
const createSuiteApi = vi.mocked(createSuite)
const updateSuiteApi = vi.mocked(updateSuite)
const deleteSuiteApi = vi.mocked(deleteSuite)
const documentSuiteApi = vi.mocked(documentSuite)

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
const updatedSuite: Suite = { ...suite, name: 'Checkout v2', manualCases: 2 }

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

function runMutation<TData, TError, TVariables>(
  client: QueryClient,
  useMutationHook: () => UseMutationResult<TData, TError, TVariables>,
  variables: NoInfer<TVariables>,
) {
  const { result } = renderHook(useMutationHook, { wrapper: wrapperFor(client) })
  result.current.mutate(variables)
  return result
}

async function cacheLiveDetail(client: QueryClient) {
  getSuiteApi.mockResolvedValueOnce(suite)
  const page = renderHook(() => useSuite('suite-1'), { wrapper: wrapperFor(client) })

  await waitFor(() => {
    expect(page.result.current.suite).toEqual(suite)
  })
  return page
}

async function mountDetailPageWithDelete(client: QueryClient) {
  getSuiteApi.mockResolvedValueOnce(suite)
  const page = renderHook(
    () => ({ detail: useSuite('suite-1'), removal: useDeleteSuite() }),
    { wrapper: wrapperFor(client) },
  )

  await waitFor(() => {
    expect(page.result.current.detail.suite).toEqual(suite)
  })
  return page
}

async function prepareResponseScenario(
  apiMock: { mockResolvedValue: (value: Suite) => unknown },
  response: Suite,
) {
  const { client, invalidateSpy } = setup()
  await cacheInactiveList(client, 'proj-1', [suite, otherSuite])
  list.mockReturnValue(new Promise(() => {}))
  apiMock.mockResolvedValue(response)
  return { client, invalidateSpy }
}

function expectCachesSyncedFrom(
  response: Suite,
  client: QueryClient,
  invalidateSpy: { mock: { calls: unknown[][] } },
) {
  expect(client.getQueryData(suiteKeys.detail(response.id))).toEqual(response)
  expect(client.getQueryData<Suite[]>(suiteKeys.list('proj-1'))).toEqual([response, otherSuite])
  expect(list).toHaveBeenCalledTimes(2)
  expect(invalidateSpy.mock.calls).not.toContainEqual([{ queryKey: suiteKeys.all }])
}

beforeEach(() => {
  vi.clearAllMocks()
  list.mockReset()
  getSuiteApi.mockReset()
  createSuiteApi.mockResolvedValue(suite)
  updateSuiteApi.mockResolvedValue(suite)
  deleteSuiteApi.mockResolvedValue(undefined)
  documentSuiteApi.mockResolvedValue({ filesEnqueued: 1, casesTargeted: 1, casesSkipped: [] })
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
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: suiteKeys.all })
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
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: suiteKeys.all })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: suiteKeys.detail('suite-1'),
    })
  })

  it('seeds the detail and patches the cached list from the returned suite without waiting on the list refetch', async () => {
    const { client, invalidateSpy } = await prepareResponseScenario(create, updatedSuite)

    const result = runMutation(client, useCreateCase, {
      suiteId: 'suite-1',
      payload: { name: 'New case' },
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expectCachesSyncedFrom(updatedSuite, client, invalidateSpy)
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

  it('seeds the detail and patches the cached list from the returned suite without waiting on the list refetch', async () => {
    const { client, invalidateSpy } = await prepareResponseScenario(update, updatedSuite)

    const result = runMutation(client, useUpdateCase, {
      suiteId: 'suite-1',
      caseId: 'case-1',
      patch: { state: 'active' },
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expectCachesSyncedFrom(updatedSuite, client, invalidateSpy)
  })
})

describe('useDocumentCase', () => {
  it('refreshes only the case suite detail, never every cached suite', async () => {
    const { client, invalidateSpy } = setup()

    const result = runMutation(client, useDocumentCase, { suiteId: 'suite-1', caseId: 'case-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: suiteKeys.detail('suite-1') })
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: suiteKeys.all })
  })


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

  it('seeds the detail and patches the cached list from the returned suite without waiting on the list refetch', async () => {
    const { client, invalidateSpy } = await prepareResponseScenario(remove, updatedSuite)

    const result = runMutation(client, useDeleteCase, { suiteId: 'suite-1', caseId: 'case-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expectCachesSyncedFrom(updatedSuite, client, invalidateSpy)
  })
})

describe('useUpdateSuite', () => {
  it('seeds the detail and patches the cached list from the returned suite without waiting on the list refetch', async () => {
    const { client, invalidateSpy } = await prepareResponseScenario(updateSuiteApi, updatedSuite)

    const result = runMutation(client, useUpdateSuite, {
      id: 'suite-1',
      patch: { name: 'Checkout v2' },
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expectCachesSyncedFrom(updatedSuite, client, invalidateSpy)
  })

  it('clears the default flag of the other cached suites when this one becomes the default', async () => {
    const { client } = setup()
    const previousDefault: Suite = { ...otherSuite, isDefault: true }
    const nowDefault: Suite = { ...suite, isDefault: true }
    await cacheInactiveList(client, 'proj-1', [suite, previousDefault])
    list.mockReturnValue(new Promise(() => {}))
    updateSuiteApi.mockResolvedValue(nowDefault)

    const result = runMutation(client, useUpdateSuite, {
      id: 'suite-1',
      patch: { isDefault: true },
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryData<Suite[]>(suiteKeys.list('proj-1'))).toEqual([
      nowDefault,
      { ...otherSuite, isDefault: false },
    ])
  })
})

describe('useCreateSuite', () => {
  const created: Suite = { ...suite, id: 'suite-3', name: 'Payments' }

  it('seeds the new detail and puts the suite at the top of the cached project list', async () => {
    const { client, invalidateSpy } = setup()
    await cacheInactiveList(client, 'proj-1', [suite, otherSuite])
    list.mockReturnValue(new Promise(() => {}))
    createSuiteApi.mockResolvedValue(created)

    const result = runMutation(client, useCreateSuite, { projectId: 'proj-1', name: 'Payments' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryData(suiteKeys.detail('suite-3'))).toEqual(created)
    expect(client.getQueryData<Suite[]>(suiteKeys.list('proj-1'))).toEqual([
      created,
      suite,
      otherSuite,
    ])
    expect(list).toHaveBeenCalledTimes(2)
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: suiteKeys.all })
  })

  it('does not build a project list that nobody has loaded', async () => {
    const { client } = setup()
    createSuiteApi.mockResolvedValue(created)

    const result = runMutation(client, useCreateSuite, { projectId: 'proj-1', name: 'Payments' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryData(suiteKeys.detail('suite-3'))).toEqual(created)
    expect(client.getQueryData(suiteKeys.list('proj-1'))).toBeUndefined()
    expect(list).not.toHaveBeenCalled()
  })

  it('clears the default flag of the other cached suites when the new one is the default', async () => {
    const { client } = setup()
    const previousDefault: Suite = { ...suite, isDefault: true }
    const createdDefault: Suite = { ...created, isDefault: true }
    await cacheInactiveList(client, 'proj-1', [previousDefault, otherSuite])
    list.mockReturnValue(new Promise(() => {}))
    createSuiteApi.mockResolvedValue(createdDefault)

    const result = runMutation(client, useCreateSuite, {
      projectId: 'proj-1',
      name: 'Payments',
      isDefault: true,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryData<Suite[]>(suiteKeys.list('proj-1'))).toEqual([
      createdDefault,
      { ...suite, isDefault: false },
      otherSuite,
    ])
  })
})

describe('useDeleteSuite', () => {
  it('drops the suite from the cached list and detail at once, then refetches the list in the background', async () => {
    const { client, invalidateSpy } = setup()
    await cacheInactiveList(client, 'proj-1', [suite, otherSuite])
    client.setQueryData(suiteKeys.detail('suite-1'), suite)
    list.mockReturnValue(new Promise(() => {}))

    const result = runMutation(client, useDeleteSuite, { id: 'suite-1', projectId: 'proj-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryData<Suite[]>(suiteKeys.list('proj-1'))).toEqual([otherSuite])
    expect(client.getQueryState(suiteKeys.detail('suite-1'))).toBeUndefined()
    expect(list).toHaveBeenCalledTimes(2)
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: suiteKeys.all })
  })

  it('keeps the detail while its page is still mounted, then evicts it once the page leaves', async () => {
    const { client } = setup()
    const page = await mountDetailPageWithDelete(client)

    page.result.current.removal.mutate({ id: 'suite-1', projectId: 'proj-1' })

    await waitFor(() => {
      expect(page.result.current.removal.isSuccess).toBe(true)
    })
    expect(page.result.current.detail.suite).toEqual(suite)
    expect(page.result.current.detail.isLoading).toBe(false)
    expect(client.getQueryData(suiteKeys.detail('suite-1'))).toEqual(suite)
    expect(getSuiteApi).toHaveBeenCalledTimes(1)

    page.unmount()

    await waitFor(() => {
      expect(client.getQueryState(suiteKeys.detail('suite-1'))).toBeUndefined()
    })
  })
})

describe('useDocumentSuite', () => {
  it('waits for the suite detail refetch so the watch starts from fresh data', async () => {
    const { client, invalidateSpy } = setup()
    await cacheLiveDetail(client)
    let release: (value: Suite) => void = () => undefined
    getSuiteApi.mockReturnValueOnce(
      new Promise<Suite>((resolve) => {
        release = resolve
      }),
    )

    const result = runMutation(client, useDocumentSuite, {
      suiteId: 'suite-1',
      projectId: 'proj-1',
      mode: 'undocumented',
    })

    await waitFor(() => {
      expect(getSuiteApi).toHaveBeenCalledTimes(2)
    })
    expect(result.current.isSuccess).toBe(false)

    release(suite)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(documentSuiteApi).toHaveBeenCalledWith('suite-1', 'undocumented')
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: suiteKeys.all })
  })

  it('marks only its own project list stale, without refetching it', async () => {
    const { client } = setup()
    await cacheInactiveList(client, 'proj-1', [suite, otherSuite])
    await cacheInactiveList(client, 'proj-2', [{ ...otherSuite, projectId: 'proj-2' }])

    const result = runMutation(client, useDocumentSuite, {
      suiteId: 'suite-1',
      projectId: 'proj-1',
      mode: 'undocumented',
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryState(suiteKeys.list('proj-1'))?.isInvalidated).toBe(true)
    expect(client.getQueryState(suiteKeys.list('proj-2'))?.isInvalidated).toBe(false)
    expect(list).toHaveBeenCalledTimes(2)
  })
})
