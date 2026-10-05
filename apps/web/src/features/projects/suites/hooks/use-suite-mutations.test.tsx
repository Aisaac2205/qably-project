import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, type UseMutationResult } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Project, Suite, TestCase } from '@qably/types'
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
import { useProject } from '../../hooks/use-project'
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
import { getProject } from '../../api/projects.api'
import { projectKeys, suiteKeys } from '../../lib/query-keys'
import { ciRunKeys, runKeys } from '@/features/runs/lib/query-keys'
import { ApiError } from '@/lib/api-client'
import { notify } from '@/lib/notify'
import { createMockTestCase } from '@/lib/test-utils'

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

vi.mock('../../api/projects.api', () => ({
  getProject: vi.fn(),
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
const getProjectApi = vi.mocked(getProject)

const emptyDocumentation = {
  outcome: null,
  missing: [],
  skipReason: null,
  queuedAt: null,
  outcomeAt: null,
}

function producedCase(
  id: string,
  suiteId: string,
  name: string,
  overrides: Partial<TestCase> = {},
): TestCase {
  return {
    ...createMockTestCase({
      id,
      suiteId,
      name,
      objective: 'Pay for an order',
      steps: ['Open the cart', 'Pay'],
      expectedResult: 'The order is created',
      documentation: emptyDocumentation,
      documentedLocale: null,
      localeStale: false,
      healthSignals: [],
      ...overrides,
    }),
    pendingProposalId: null,
  }
}

function producedSuite(
  id: string,
  name: string,
  cases: TestCase[],
  overrides: Partial<Suite> = {},
): Suite {
  const automatedCases = cases.filter((entry) => entry.executionMode === 'automated').length

  return {
    id,
    projectId: 'proj-1',
    organizationId: 'org-1',
    name,
    description: '',
    tags: [],
    isDefault: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    manualCases: cases.length - automatedCases,
    automatedCases,
    undocumentedCount: 0,
    staleLocaleCount: 0,
    incompleteCount: 0,
    documentation: emptyDocumentation,
    healthSummary: {},
    openCollisions: 0,
    cases,
    ...overrides,
  }
}

const caseOne = producedCase('case-1', 'suite-1', 'Pays by card')
const caseTwo = producedCase('case-2', 'suite-1', 'Pays by voucher')

const suite = producedSuite('suite-1', 'Checkout', [caseOne])
const otherSuite = producedSuite('suite-2', 'Login', [
  producedCase('case-3', 'suite-2', 'Logs in with a password'),
])
const thirdSuite = producedSuite('suite-3', 'Profile', [
  producedCase('case-4', 'suite-3', 'Edits the avatar'),
])

const renamedSuite = producedSuite('suite-1', 'Checkout v2', [caseOne])
const suiteWithNewCase = producedSuite('suite-1', 'Checkout', [caseOne, caseTwo])
const suiteWithEditedCase = producedSuite('suite-1', 'Checkout', [
  {
    ...caseOne,
    steps: ['Open the cart', 'Enter the card', 'Pay'],
    expectedResult: 'The order is paid',
  },
])
const suiteWithoutCases = producedSuite('suite-1', 'Checkout', [])
const suiteWithThreeCases = producedSuite('suite-1', 'Checkout', [
  caseOne,
  caseTwo,
  producedCase('case-5', 'suite-1', 'Pays by transfer'),
])

const project: Project = {
  id: 'proj-1',
  name: 'Shop',
  organizationId: 'org-1',
  technologies: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  hasManualCases: true,
}

function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 60_000 },
      mutations: { retry: false },
    },
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
  apiMock.mockResolvedValue(response)
  return { client, invalidateSpy }
}

function expectSuiteAdopted(
  response: Suite,
  client: QueryClient,
  invalidateSpy: { mock: { calls: unknown[][] } },
) {
  expect(client.getQueryData(suiteKeys.detail(response.id))).toEqual(response)
  expect(client.getQueryState(suiteKeys.detail(response.id))?.isInvalidated).toBe(false)
  expect(client.getQueryData<Suite[]>(suiteKeys.list('proj-1'))).toEqual([response, otherSuite])
  expect(client.getQueryState(suiteKeys.list('proj-1'))?.isInvalidated).toBe(true)
  expect(list).toHaveBeenCalledTimes(1)
  expect(invalidateSpy.mock.calls).not.toContainEqual([{ queryKey: suiteKeys.all }])
  expect(invalidateSpy.mock.calls).not.toContainEqual([
    { queryKey: suiteKeys.detail(response.id) },
  ])
}

beforeEach(() => {
  vi.clearAllMocks()
  list.mockReset()
  getSuiteApi.mockReset()
  getProjectApi.mockReset()
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
      wrapper: wrapperFor(client),
    })

    result.current.mutate({ suiteId: 'suite-1', projectId: 'proj-1' })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: suiteKeys.detail('suite-1'),
      })
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: projectKeys.detail('proj-1'),
      refetchType: 'none',
    })
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: suiteKeys.all })
    expect(confirm).toHaveBeenCalledWith('suite-1', undefined)
  })

  it('patches the cached list from the confirmed suite and leaves it stale for the next visit instead of fetching it', async () => {
    const { client } = setup()
    await cacheInactiveList(client, 'proj-1', [suite, otherSuite])
    client.setQueryData(suiteKeys.detail('suite-1'), renamedSuite)
    const { result } = renderHook(() => useConfirmDocumentation(), {
      wrapper: wrapperFor(client),
    })

    result.current.mutate({ suiteId: 'suite-1', projectId: 'proj-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryData<Suite[]>(suiteKeys.list('proj-1'))).toEqual([
      renamedSuite,
      otherSuite,
    ])
    expect(client.getQueryState(suiteKeys.list('proj-1'))?.isInvalidated).toBe(true)
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('adopts the detail it just refetched when the suite page is open', async () => {
    const { client } = setup()
    await cacheInactiveList(client, 'proj-1', [suite, otherSuite])
    await cacheLiveDetail(client)
    getSuiteApi.mockResolvedValueOnce(renamedSuite)
    const { result } = renderHook(() => useConfirmDocumentation(), {
      wrapper: wrapperFor(client),
    })

    result.current.mutate({ suiteId: 'suite-1', projectId: 'proj-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryData<Suite[]>(suiteKeys.list('proj-1'))).toEqual([
      renamedSuite,
      otherSuite,
    ])
    expect(client.getQueryState(suiteKeys.list('proj-1'))?.isInvalidated).toBe(true)
  })

  it('leaves the suite list of another project untouched', async () => {
    const { client } = setup()
    await cacheInactiveList(client, 'proj-1', [suite])
    await cacheInactiveList(client, 'proj-2', [{ ...otherSuite, projectId: 'proj-2' }])
    const { result } = renderHook(() => useConfirmDocumentation(), {
      wrapper: wrapperFor(client),
    })

    result.current.mutate({ suiteId: 'suite-1', projectId: 'proj-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryState(suiteKeys.list('proj-1'))?.isInvalidated).toBe(true)
    expect(client.getQueryState(suiteKeys.list('proj-2'))?.isInvalidated).toBe(false)
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('forwards the selected case ids to the API call', async () => {
    const { client } = setup()
    const { result } = renderHook(() => useConfirmDocumentation(), {
      wrapper: wrapperFor(client),
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
  it('marks the project detail stale so hasManualCases reflects the new case on the next visit', async () => {
    const { client, invalidateSpy } = setup()
    client.setQueryData(projectKeys.detail('proj-1'), project)
    const { result } = renderHook(() => useCreateCase(), {
      wrapper: wrapperFor(client),
    })

    result.current.mutate({ suiteId: 'suite-1', payload: { name: 'New case' } })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: projectKeys.detail('proj-1'),
        refetchType: 'none',
      })
    })
    expect(client.getQueryState(projectKeys.detail('proj-1'))?.isInvalidated).toBe(true)
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: suiteKeys.all })
  })

  it('shows the first manual case at once by patching the cached project, without a request', async () => {
    const { client } = setup()
    client.setQueryData(projectKeys.detail('proj-1'), { ...project, hasManualCases: false })
    create.mockResolvedValue(suiteWithNewCase)

    const result = runMutation(client, useCreateCase, {
      suiteId: 'suite-1',
      payload: { name: 'Pays by voucher' },
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryData<Project>(projectKeys.detail('proj-1'))?.hasManualCases).toBe(true)
    expect(client.getQueryState(projectKeys.detail('proj-1'))?.isInvalidated).toBe(true)
    expect(getProjectApi).not.toHaveBeenCalled()
  })

  it('leaves hasManualCases alone when the saved case is not an active manual case', async () => {
    const { client } = setup()
    client.setQueryData(projectKeys.detail('proj-1'), { ...project, hasManualCases: false })
    create.mockResolvedValue(
      producedSuite('suite-1', 'Checkout', [
        producedCase('case-6', 'suite-1', 'Draft by hand', { state: 'draft' }),
        producedCase('case-7', 'suite-1', 'Runs in CI', {
          executionMode: 'automated',
          state: 'active',
        }),
      ]),
    )

    const result = runMutation(client, useCreateCase, {
      suiteId: 'suite-1',
      payload: { name: 'Draft by hand' },
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryData<Project>(projectKeys.detail('proj-1'))?.hasManualCases).toBe(false)
  })

  it('keeps hasManualCases true, only stale, after the last manual case is removed, since only the server knows', async () => {
    const { client } = setup()
    client.setQueryData(projectKeys.detail('proj-1'), { ...project, hasManualCases: true })
    remove.mockResolvedValue(suiteWithoutCases)

    const result = runMutation(client, useDeleteCase, { suiteId: 'suite-1', caseId: 'case-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryData<Project>(projectKeys.detail('proj-1'))?.hasManualCases).toBe(true)
    expect(client.getQueryState(projectKeys.detail('proj-1'))?.isInvalidated).toBe(true)
  })

  it('adopts every saved case without refetching the observed detail or project', async () => {
    const { client } = setup()
    getSuiteApi.mockResolvedValue(suite)
    getProjectApi.mockResolvedValue(project)
    const editPage = renderHook(
      () => ({
        detail: useSuite('suite-1'),
        project: useProject('proj-1'),
        saving: useCreateCase(),
      }),
      { wrapper: wrapperFor(client) },
    )
    await waitFor(() => {
      expect(editPage.result.current.detail.suite).toEqual(suite)
      expect(editPage.result.current.project.project).toEqual(project)
    })
    create.mockResolvedValueOnce(suiteWithNewCase).mockResolvedValueOnce(suiteWithThreeCases)

    await act(async () => {
      await editPage.result.current.saving.mutateAsync({
        suiteId: 'suite-1',
        payload: { name: 'Pays by voucher' },
      })
    })
    await act(async () => {
      await editPage.result.current.saving.mutateAsync({
        suiteId: 'suite-1',
        payload: { name: 'Pays by transfer' },
      })
    })

    expect(client.getQueryData(suiteKeys.detail('suite-1'))).toEqual(suiteWithThreeCases)
    await waitFor(() => {
      expect(editPage.result.current.detail.suite).toEqual(suiteWithThreeCases)
    })
    expect(getSuiteApi).toHaveBeenCalledTimes(1)
    expect(getProjectApi).toHaveBeenCalledTimes(1)
    expect(client.getQueryState(projectKeys.detail('proj-1'))?.isInvalidated).toBe(true)
  })

  it('keeps the response when a detail fetch that started before it settles afterwards', async () => {
    const { client } = setup()
    await cacheLiveDetail(client)
    let settleOldFetch: (value: Suite) => void = () => undefined
    getSuiteApi.mockReturnValueOnce(
      new Promise<Suite>((resolve) => {
        settleOldFetch = resolve
      }),
    )
    void client.refetchQueries({ queryKey: suiteKeys.detail('suite-1') })
    await waitFor(() => {
      expect(getSuiteApi).toHaveBeenCalledTimes(2)
    })
    create.mockResolvedValue(suiteWithNewCase)

    const result = runMutation(client, useCreateCase, {
      suiteId: 'suite-1',
      payload: { name: 'Pays by voucher' },
    })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    settleOldFetch(suite)
    await act(async () => {
      await Promise.resolve()
    })

    expect(client.getQueryData(suiteKeys.detail('suite-1'))).toEqual(suiteWithNewCase)
  })

  it('adopts the returned suite into the detail and list, replacing the old cases, and leaves the list stale without fetching it', async () => {
    const { client, invalidateSpy } = await prepareResponseScenario(create, suiteWithNewCase)

    const result = runMutation(client, useCreateCase, {
      suiteId: 'suite-1',
      payload: { name: 'Pays by voucher' },
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expectSuiteAdopted(suiteWithNewCase, client, invalidateSpy)
  })
})

describe('useUpdateCase', () => {
  it('marks the project detail stale so hasManualCases reflects an executionMode change on the next visit', async () => {
    const { client, invalidateSpy } = setup()
    const { result } = renderHook(() => useUpdateCase(), {
      wrapper: wrapperFor(client),
    })

    result.current.mutate({
      suiteId: 'suite-1',
      caseId: 'case-1',
      patch: { state: 'active' },
    })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: projectKeys.detail('proj-1'),
        refetchType: 'none',
      })
    })
  })

  it('adopts the returned suite into the detail and list, replacing the old cases, and leaves the list stale without fetching it', async () => {
    const { client, invalidateSpy } = await prepareResponseScenario(update, suiteWithEditedCase)

    const result = runMutation(client, useUpdateCase, {
      suiteId: 'suite-1',
      caseId: 'case-1',
      patch: { steps: ['Open the cart', 'Enter the card', 'Pay'] },
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expectSuiteAdopted(suiteWithEditedCase, client, invalidateSpy)
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

  it('leaves cached run details alone, since nothing in the library changes until the proposal is approved', async () => {
    const { client, invalidateSpy } = setup()
    client.setQueryData(runKeys.detail('run-1'), { id: 'run-1' })

    const result = runMutation(client, useDocumentCase, { suiteId: 'suite-1', caseId: 'case-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryState(runKeys.detail('run-1'))?.isInvalidated).toBe(false)
    expect(invalidateSpy).not.toHaveBeenCalledWith(expect.objectContaining({ queryKey: runKeys.details }))
  })

  it('queues the case and notifies success', async () => {
    const { client } = setup()
    const { result } = renderHook(() => useDocumentCase(), {
      wrapper: wrapperFor(client),
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
      wrapper: wrapperFor(client),
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
      wrapper: wrapperFor(client),
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
      wrapper: wrapperFor(client),
    })

    result.current.mutate({ suiteId: 'suite-1', caseId: 'case-1' })

    await waitFor(() => {
      expect(notify.error).toHaveBeenCalledWith('Could not queue this documentation. Try again.')
    })
  })
})

describe('useDeleteCase', () => {
  it('marks the project detail stale so hasManualCases reflects the removed case on the next visit', async () => {
    const { client, invalidateSpy } = setup()
    const { result } = renderHook(() => useDeleteCase(), {
      wrapper: wrapperFor(client),
    })

    result.current.mutate({ suiteId: 'suite-1', caseId: 'case-1' })

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: projectKeys.detail('proj-1'),
        refetchType: 'none',
      })
    })
  })

  it('adopts the returned suite into the detail and list, dropping the removed case, and leaves the list stale without fetching it', async () => {
    const { client, invalidateSpy } = await prepareResponseScenario(remove, suiteWithoutCases)

    const result = runMutation(client, useDeleteCase, { suiteId: 'suite-1', caseId: 'case-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expectSuiteAdopted(suiteWithoutCases, client, invalidateSpy)
  })
})

describe('useUpdateSuite', () => {
  it('adopts the returned suite into the detail and list and leaves the list stale without fetching it', async () => {
    const { client, invalidateSpy } = await prepareResponseScenario(updateSuiteApi, renamedSuite)

    const result = runMutation(client, useUpdateSuite, {
      id: 'suite-1',
      patch: { name: 'Checkout v2' },
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expectSuiteAdopted(renamedSuite, client, invalidateSpy)
  })

  it('refetches the list when it is on screen, so the visible rows reconcile with the server', async () => {
    const { client } = setup()
    list.mockResolvedValueOnce([suite, otherSuite])
    const onScreen = renderHook(() => useSuites('proj-1'), { wrapper: wrapperFor(client) })
    await waitFor(() => {
      expect(onScreen.result.current.suites).toHaveLength(2)
    })
    const fromServer: Suite = { ...renamedSuite, description: 'Normalised by the server' }
    list.mockResolvedValueOnce([fromServer, otherSuite])
    updateSuiteApi.mockResolvedValue(renamedSuite)

    const result = runMutation(client, useUpdateSuite, {
      id: 'suite-1',
      patch: { name: 'Checkout v2' },
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    await waitFor(() => {
      expect(onScreen.result.current.suites[0]).toEqual(fromServer)
    })
    expect(list).toHaveBeenCalledTimes(2)
  })

  it('clears the default flag of the other cached suites, and stales their cached details, when this one becomes the default', async () => {
    const { client } = setup()
    const previousDefault: Suite = { ...otherSuite, isDefault: true }
    const nowDefault: Suite = { ...suite, isDefault: true }
    await cacheInactiveList(client, 'proj-1', [suite, previousDefault, thirdSuite])
    client.setQueryData(suiteKeys.detail('suite-2'), previousDefault)
    client.setQueryData(suiteKeys.detail('suite-3'), thirdSuite)
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
      thirdSuite,
    ])
    expect(client.getQueryState(suiteKeys.detail('suite-2'))?.isInvalidated).toBe(true)
    expect(client.getQueryState(suiteKeys.detail('suite-3'))?.isInvalidated).toBe(false)
  })
})

describe('useCreateSuite', () => {
  const created = producedSuite('suite-4', 'Payments', [])

  it('seeds the new detail and puts the suite at the top of the cached project list, leaving the list stale without fetching it', async () => {
    const { client, invalidateSpy } = setup()
    await cacheInactiveList(client, 'proj-1', [suite, otherSuite])
    createSuiteApi.mockResolvedValue(created)

    const result = runMutation(client, useCreateSuite, { projectId: 'proj-1', name: 'Payments' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryData(suiteKeys.detail('suite-4'))).toEqual(created)
    expect(client.getQueryState(suiteKeys.detail('suite-4'))?.isInvalidated).toBe(false)
    expect(client.getQueryData<Suite[]>(suiteKeys.list('proj-1'))).toEqual([
      created,
      suite,
      otherSuite,
    ])
    expect(client.getQueryState(suiteKeys.list('proj-1'))?.isInvalidated).toBe(true)
    expect(list).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: suiteKeys.all })
  })

  it('does not build a project list that nobody has loaded', async () => {
    const { client } = setup()
    createSuiteApi.mockResolvedValue(created)

    const result = runMutation(client, useCreateSuite, { projectId: 'proj-1', name: 'Payments' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryData(suiteKeys.detail('suite-4'))).toEqual(created)
    expect(client.getQueryData(suiteKeys.list('proj-1'))).toBeUndefined()
    expect(list).not.toHaveBeenCalled()
  })

  it('clears the default flag of the other cached suites, and stales their cached details, when the new one is the default', async () => {
    const { client } = setup()
    const previousDefault: Suite = { ...suite, isDefault: true }
    const createdDefault: Suite = { ...created, isDefault: true }
    await cacheInactiveList(client, 'proj-1', [previousDefault, otherSuite])
    client.setQueryData(suiteKeys.detail('suite-1'), previousDefault)
    client.setQueryData(suiteKeys.detail('suite-2'), otherSuite)
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
    expect(client.getQueryState(suiteKeys.detail('suite-1'))?.isInvalidated).toBe(true)
    expect(client.getQueryState(suiteKeys.detail('suite-2'))?.isInvalidated).toBe(false)
  })
})

describe('useDeleteSuite', () => {
  it('drops the suite from the cached list and detail at once and leaves the list stale without fetching it', async () => {
    const { client, invalidateSpy } = setup()
    await cacheInactiveList(client, 'proj-1', [suite, otherSuite])
    client.setQueryData(suiteKeys.detail('suite-1'), suite)

    const result = runMutation(client, useDeleteSuite, { id: 'suite-1', projectId: 'proj-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(client.getQueryData<Suite[]>(suiteKeys.list('proj-1'))).toEqual([otherSuite])
    expect(client.getQueryState(suiteKeys.list('proj-1'))?.isInvalidated).toBe(true)
    expect(client.getQueryState(suiteKeys.detail('suite-1'))).toBeUndefined()
    expect(list).toHaveBeenCalledTimes(1)
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: suiteKeys.all })
  })

  it('marks the project detail stale so hasManualCases reflects the removed suite on the next visit', async () => {
    const { client, invalidateSpy } = setup()

    const result = runMutation(client, useDeleteSuite, { id: 'suite-1', projectId: 'proj-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: projectKeys.detail('proj-1'),
      refetchType: 'none',
    })
  })

  it('marks the run list pages of its project stale without fetching them, since the runs of the suite go with it', async () => {
    const { client, invalidateSpy } = setup()
    client.setQueryData(runKeys.page('proj-1', 'manual'), { pages: [], pageParams: [] })
    client.setQueryData(runKeys.page('proj-1', 'all'), { pages: [], pageParams: [] })
    client.setQueryData(runKeys.page('proj-2', 'manual'), { pages: [], pageParams: [] })

    const result = runMutation(client, useDeleteSuite, { id: 'suite-1', projectId: 'proj-1' })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: runKeys.pages('proj-1'),
      refetchType: 'none',
    })
    expect(client.getQueryState(runKeys.page('proj-1', 'manual'))?.isInvalidated).toBe(true)
    expect(client.getQueryState(runKeys.page('proj-1', 'all'))?.isInvalidated).toBe(true)
    expect(client.getQueryState(runKeys.page('proj-2', 'manual'))?.isInvalidated).toBe(false)
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


describe('run details', () => {
  const triggers: Array<[string, (client: QueryClient) => void]> = [
    [
      'creating a case',
      (client) => {
        runMutation(client, useCreateCase, { suiteId: 'suite-1', payload: { name: 'New case' } })
      },
    ],
    [
      'editing a case',
      (client) => {
        runMutation(client, useUpdateCase, {
          suiteId: 'suite-1',
          caseId: 'case-1',
          patch: { name: 'Renamed' },
        })
      },
    ],
    [
      'deleting a case',
      (client) => {
        runMutation(client, useDeleteCase, { suiteId: 'suite-1', caseId: 'case-1' })
      },
    ],
    [
      'confirming documentation',
      (client) => {
        runMutation(client, useConfirmDocumentation, { suiteId: 'suite-1', projectId: 'proj-1' })
      },
    ],
    [
      'editing a suite',
      (client) => {
        runMutation(client, useUpdateSuite, { id: 'suite-1', patch: { name: 'Checkout v2' } })
      },
    ],
    [
      'deleting a suite',
      (client) => {
        runMutation(client, useDeleteSuite, { id: 'suite-1', projectId: 'proj-1' })
      },
    ],
  ]

  it.each(triggers)('marks cached run details stale after %s, without fetching them', async (label, trigger) => {
    const { client, invalidateSpy } = setup()
    client.setQueryData(runKeys.detail('run-1'), { id: 'run-1' })
    client.setQueryData(runKeys.list('proj-1'), { items: [] })
    client.setQueryData(runKeys.page('proj-1', 'manual'), { pages: [], pageParams: [] })

    trigger(client)

    await waitFor(() => {
      expect(client.getQueryState(runKeys.detail('run-1'))?.isInvalidated).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: runKeys.details,
      refetchType: 'none',
    })
    expect(client.getQueryState(runKeys.list('proj-1'))?.isInvalidated).toBe(false)
    expect(client.getQueryState(runKeys.page('proj-1', 'manual'))?.isInvalidated).toBe(
      label === 'deleting a suite',
    )
  })

  it('marks the CI run detail and the CI run list of the project stale after deleting a suite, without fetching them', async () => {
    const { client, invalidateSpy } = setup()
    client.setQueryData(ciRunKeys.detail('ci-1'), { id: 'ci-1', runs: [] })
    client.setQueryData(ciRunKeys.page('proj-1'), { pages: [], pageParams: [] })
    client.setQueryData(ciRunKeys.page('proj-2'), { pages: [], pageParams: [] })

    runMutation(client, useDeleteSuite, { id: 'suite-1', projectId: 'proj-1' })

    await waitFor(() => {
      expect(client.getQueryState(ciRunKeys.detail('ci-1'))?.isInvalidated).toBe(true)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ciRunKeys.details,
      refetchType: 'none',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ciRunKeys.page('proj-1'),
      refetchType: 'none',
    })
    expect(client.getQueryState(ciRunKeys.page('proj-1'))?.isInvalidated).toBe(true)
    expect(client.getQueryState(ciRunKeys.page('proj-2'))?.isInvalidated).toBe(false)
  })

  it.each(triggers.filter(([label]) => label !== 'deleting a suite'))(
    'leaves the CI runs alone after %s, since no run is deleted',
    async (_label, trigger) => {
      const { client } = setup()
      client.setQueryData(runKeys.detail('run-1'), { id: 'run-1' })
      client.setQueryData(ciRunKeys.detail('ci-1'), { id: 'ci-1', runs: [] })
      client.setQueryData(ciRunKeys.page('proj-1'), { pages: [], pageParams: [] })

      trigger(client)

      await waitFor(() => {
        expect(client.getQueryState(runKeys.detail('run-1'))?.isInvalidated).toBe(true)
      })
      expect(client.getQueryState(ciRunKeys.detail('ci-1'))?.isInvalidated).toBe(false)
      expect(client.getQueryState(ciRunKeys.page('proj-1'))?.isInvalidated).toBe(false)
    },
  )
})
