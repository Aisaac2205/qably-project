import { act, renderHook } from '@testing-library/react'
import type { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Suite, SuiteSummary } from '@qably/types'
import { projectKeys, suiteKeys } from '@/features/projects/lib/query-keys'
import {
  createCase,
  createSuite,
  deleteCase,
  deleteSuite,
  updateCase,
  updateSuite,
} from '@/features/projects/suites/api/suites.api'
import {
  useCreateCase,
  useCreateSuite,
  useDeleteCase,
  useDeleteSuite,
  useUpdateCase,
  useUpdateSuite,
} from '@/features/projects/suites/hooks/use-suite-mutations'
import { invalidateSuiteAndProjectLists } from '@/features/review-inbox/lib/invalidate-after-decision'
import { casesOf, suite } from '@/test/suite-summaries-fixtures'
import { summary, wrapperFor } from './suite-summaries-test-data'
import {
  OTHER_PROJECT,
  RECENT,
  SEARCH,
  dataOf,
  idsIn,
  itemOf,
  itemsOf,
  seededClient,
} from './suite-summaries-cache-test-data'

vi.mock('@/features/projects/suites/api/suites.api', () => ({
  confirmDocumentation: vi.fn(),
  createCase: vi.fn(),
  createSuite: vi.fn(),
  deleteCase: vi.fn(),
  deleteSuite: vi.fn(),
  documentCase: vi.fn(),
  documentSuite: vi.fn(),
  updateCase: vi.fn(),
  updateSuite: vi.fn(),
}))

const createSuiteApi = vi.mocked(createSuite)
const updateSuiteApi = vi.mocked(updateSuite)
const deleteSuiteApi = vi.mocked(deleteSuite)
const createCaseApi = vi.mocked(createCase)
const updateCaseApi = vi.mocked(updateCase)
const deleteCaseApi = vi.mocked(deleteCase)

const SUMMARIES_FILTER = JSON.stringify(suiteKeys.summaries('proj-1'))

function watchSummariesAtInvalidation(client: QueryClient): SuiteSummary[][] {
  const snapshots: SuiteSummary[][] = []
  const original = client.invalidateQueries.bind(client)

  vi.spyOn(client, 'invalidateQueries').mockImplementation((filters, options) => {
    if (JSON.stringify(filters?.queryKey) === SUMMARIES_FILTER) {
      snapshots.push(itemsOf(client, RECENT))
    }

    return original(filters, options)
  })

  return snapshots
}

async function updateSuiteTo(client: QueryClient, fresh: Suite) {
  updateSuiteApi.mockResolvedValue(fresh)
  const { result } = renderHook(() => useUpdateSuite(), { wrapper: wrapperFor(client) })

  await act(async () => {
    await result.current.mutateAsync({ id: fresh.id, patch: { name: fresh.name } })
  })
}

function isInvalidated(client: QueryClient, key: readonly unknown[]): boolean | undefined {
  return client.getQueryState(key)?.isInvalidated
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useUpdateSuite and the paged suite summaries', () => {
  const renamed = suite('c', {
    projectId: 'proj-1',
    name: 'Aardvark',
    description: 'fresh description',
    tags: ['new'],
    cases: casesOf(3),
  })

  it('patches the suite on page two of every variant and keeps its derived status', async () => {
    const client = seededClient()

    await updateSuiteTo(client, renamed)

    for (const key of [RECENT, SEARCH]) {
      expect(itemOf(client, key, 'c')).toMatchObject({
        name: 'Aardvark',
        description: 'fresh description',
        tags: ['new'],
        caseCount: 3,
        status: 'needs-attention',
        recentPassRate: 60,
      })
    }
  })

  it('does not reorder any row', async () => {
    const client = seededClient()

    await updateSuiteTo(client, renamed)

    expect(idsIn(client, RECENT)).toEqual(['a', 'b', 'c', 'd'])
    expect(idsIn(client, SEARCH)).toEqual(['c', 'e'])
  })

  it('patches the rows before it invalidates the summaries', async () => {
    const client = seededClient()
    const snapshots = watchSummariesAtInvalidation(client)

    await updateSuiteTo(client, renamed)

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.find((item) => item.id === 'c')?.name).toBe('Aardvark')
    expect(isInvalidated(client, RECENT)).toBe(true)
    expect(isInvalidated(client, SEARCH)).toBe(true)
  })

  it('clears the default flag of the other suites when it becomes the default', async () => {
    const client = seededClient()

    await updateSuiteTo(client, suite('c', { projectId: 'proj-1', isDefault: true }))

    expect(itemOf(client, RECENT, 'c')?.isDefault).toBe(true)
    expect(itemOf(client, RECENT, 'a')?.isDefault).toBe(false)
    expect(itemOf(client, OTHER_PROJECT, 'z')?.isDefault).toBe(true)
  })

  it('succeeds and still invalidates when the suite is on no loaded page', async () => {
    const client = seededClient()
    const before = client.getQueryData(RECENT)

    await updateSuiteTo(client, suite('not-loaded', { projectId: 'proj-1', name: 'Elsewhere' }))

    expect(client.getQueryData(RECENT)).toBe(before)
    expect(isInvalidated(client, RECENT)).toBe(true)
  })

  it('leaves the summaries of another project alone', async () => {
    const client = seededClient()

    await updateSuiteTo(client, renamed)

    expect(isInvalidated(client, OTHER_PROJECT)).toBe(false)
  })
})

describe('useDeleteSuite and the paged suite summaries', () => {
  async function deleteSuiteC(client: QueryClient) {
    deleteSuiteApi.mockResolvedValue(undefined)
    const { result } = renderHook(() => useDeleteSuite(), { wrapper: wrapperFor(client) })

    await act(async () => {
      await result.current.mutateAsync({ id: 'c', projectId: 'proj-1' })
    })
  }

  it('removes the suite from every page of every variant', async () => {
    const client = seededClient()

    await deleteSuiteC(client)

    expect(idsIn(client, RECENT)).toEqual(['a', 'b', 'd'])
    expect(idsIn(client, SEARCH)).toEqual(['e'])
  })

  it('removes the suite before it invalidates the summaries', async () => {
    const client = seededClient()
    const snapshots = watchSummariesAtInvalidation(client)

    await deleteSuiteC(client)

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.map((item) => item.id)).toEqual(['a', 'b', 'd'])
    expect(isInvalidated(client, RECENT)).toBe(true)
  })

  it('still evicts the detail and marks the project stale', async () => {
    const client = seededClient()
    client.setQueryData(projectKeys.detail('proj-1'), { id: 'proj-1' })

    await deleteSuiteC(client)

    expect(client.getQueryData(suiteKeys.detail('c'))).toBeUndefined()
    expect(isInvalidated(client, projectKeys.detail('proj-1'))).toBe(true)
  })

  it('refreshes the tag facet, which may have lost its last use of a tag', async () => {
    const client = seededClient()

    await deleteSuiteC(client)

    expect(isInvalidated(client, suiteKeys.tags('proj-1'))).toBe(true)
    expect(isInvalidated(client, suiteKeys.tags('proj-2'))).toBe(false)
  })
})

describe('useCreateSuite and the paged suite summaries', () => {
  async function createSuiteAs(client: QueryClient, created: Suite) {
    createSuiteApi.mockResolvedValue(created)
    const { result } = renderHook(() => useCreateSuite(), { wrapper: wrapperFor(client) })

    await act(async () => {
      await result.current.mutateAsync({ projectId: 'proj-1', name: created.name })
    })
  }

  it('inserts no row, because its place depends on the order the server uses', async () => {
    const client = seededClient()

    await createSuiteAs(client, suite('fresh', { projectId: 'proj-1', name: 'Zulu' }))

    expect(idsIn(client, RECENT)).toEqual(['a', 'b', 'c', 'd'])
    expect(idsIn(client, SEARCH)).toEqual(['c', 'e'])
  })

  it('invalidates the summaries and the tag facet of the project', async () => {
    const client = seededClient()

    await createSuiteAs(client, suite('fresh', { projectId: 'proj-1', name: 'Zulu' }))

    expect(isInvalidated(client, RECENT)).toBe(true)
    expect(isInvalidated(client, SEARCH)).toBe(true)
    expect(isInvalidated(client, suiteKeys.tags('proj-1'))).toBe(true)
    expect(isInvalidated(client, OTHER_PROJECT)).toBe(false)
    expect(isInvalidated(client, suiteKeys.tags('proj-2'))).toBe(false)
  })

  it('clears the default flag of the previous default when the new suite is the default', async () => {
    const client = seededClient()

    await createSuiteAs(
      client,
      suite('fresh', { projectId: 'proj-1', name: 'Zulu', isDefault: true }),
    )

    expect(itemOf(client, RECENT, 'a')?.isDefault).toBe(false)
  })
})

describe('case mutations and the paged suite summaries', () => {
  const withTwoCases = suite('c', { projectId: 'proj-1', cases: casesOf(2) })
  const withoutCases = suite('c', { projectId: 'proj-1', cases: [] })

  async function createCaseOn(client: QueryClient) {
    const { result } = renderHook(() => useCreateCase(), { wrapper: wrapperFor(client) })

    await act(async () => {
      await result.current.mutateAsync({ suiteId: 'c', payload: { name: 'A new case' } })
    })
  }

  async function updateCaseOn(client: QueryClient) {
    const { result } = renderHook(() => useUpdateCase(), { wrapper: wrapperFor(client) })

    await act(async () => {
      await result.current.mutateAsync({
        suiteId: 'c',
        caseId: 'case-0',
        patch: { priority: 'high' },
      })
    })
  }

  async function deleteCaseOn(client: QueryClient) {
    const { result } = renderHook(() => useDeleteCase(), { wrapper: wrapperFor(client) })

    await act(async () => {
      await result.current.mutateAsync({ suiteId: 'c', caseId: 'case-0' })
    })
  }

  it('sets the case count from the suite the server returns after a case is created', async () => {
    const client = seededClient()
    createCaseApi.mockResolvedValue(withTwoCases)

    await createCaseOn(client)

    expect(itemOf(client, RECENT, 'c')?.caseCount).toBe(2)
    expect(itemOf(client, SEARCH, 'c')?.caseCount).toBe(2)
    expect(isInvalidated(client, RECENT)).toBe(true)
  })

  it('sets the case count from the suite the server returns after a case is deleted', async () => {
    const client = seededClient()
    client.setQueryData(RECENT, dataOf([summary('c', { caseCount: 1 })]))
    deleteCaseApi.mockResolvedValue(withoutCases)

    await deleteCaseOn(client)

    expect(itemOf(client, RECENT, 'c')?.caseCount).toBe(0)
    expect(isInvalidated(client, RECENT)).toBe(true)
  })

  it('keeps the count the server returns after a case is edited and still invalidates', async () => {
    const client = seededClient()
    updateCaseApi.mockResolvedValue(withTwoCases)

    await updateCaseOn(client)

    expect(itemOf(client, RECENT, 'c')?.caseCount).toBe(2)
    expect(isInvalidated(client, SEARCH)).toBe(true)
  })

  it('patches the rows before it invalidates the summaries', async () => {
    const client = seededClient()
    createCaseApi.mockResolvedValue(withTwoCases)
    const snapshots = watchSummariesAtInvalidation(client)

    await createCaseOn(client)

    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.find((item) => item.id === 'c')?.caseCount).toBe(2)
  })
})

describe('a review decision and the paged suite summaries', () => {
  it('refreshes the summaries and the tag facet of every project', () => {
    const client = seededClient()

    invalidateSuiteAndProjectLists(client)

    expect(isInvalidated(client, RECENT)).toBe(true)
    expect(isInvalidated(client, SEARCH)).toBe(true)
    expect(isInvalidated(client, OTHER_PROJECT)).toBe(true)
    expect(isInvalidated(client, suiteKeys.tags('proj-1'))).toBe(true)
  })
})
