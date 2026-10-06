import { describe, expect, it } from 'vitest'
import { mockSuites } from '@/lib/mock-data'
import { createTestQueryClient } from '@/lib/query-test-utils'
import { suiteKeys } from '@/features/projects/lib/query-keys'
import { listSuiteSummaries, listSuiteTags } from '@/test/suites-api-stub'

const PROJECT_IDS = [...new Set(mockSuites.map((suite) => suite.projectId))]

interface SeededPages {
  pages: { items: { id: string; name: string }[]; nextCursor: string | null }[]
  pageParams: unknown[]
}

describe('createTestQueryClient suite seeds', () => {
  it('seeds the default summaries page of the project in the infinite query shape', () => {
    const client = createTestQueryClient()

    const seed = client.getQueryData<SeededPages>(
      suiteKeys.summaryPage('proj-1', { sort: 'recent' }),
    )

    expect(seed?.pageParams).toStrictEqual([undefined])
    expect(seed?.pages).toHaveLength(1)
    expect(seed?.pages[0]?.items.map((item) => item.id)).toEqual([
      'suite-4',
      'suite-3',
      'suite-2',
      'suite-1',
    ])
    expect(seed?.pages[0]?.nextCursor).toBeNull()
  })

  it.each(PROJECT_IDS)('seeds the page of %s with what a first request returns', async (projectId) => {
    const client = createTestQueryClient()

    const seed = client.getQueryData(suiteKeys.summaryPage(projectId, { sort: 'recent' }))

    expect(seed).toStrictEqual({
      pages: [await listSuiteSummaries({ projectId, sort: 'recent', limit: 50 })],
      pageParams: [undefined],
    })
  })

  it.each(PROJECT_IDS)('seeds the tags facet of %s', async (projectId) => {
    const client = createTestQueryClient()

    expect(client.getQueryData(suiteKeys.tags(projectId))).toStrictEqual(
      await listSuiteTags(projectId),
    )
  })

  it('seeds no other filter variant', () => {
    const client = createTestQueryClient()

    expect(
      client.getQueryData(suiteKeys.summaryPage('proj-1', { sort: 'name' })),
    ).toBeUndefined()
    expect(
      client.getQueryData(suiteKeys.summaryPage('proj-1', { sort: 'recent', search: 'a' })),
    ).toBeUndefined()
  })

  it('hands every client its own copy of the seeds', () => {
    const key = suiteKeys.summaryPage('proj-1', { sort: 'recent' })
    const first = createTestQueryClient().getQueryData<SeededPages>(key)
    const second = createTestQueryClient().getQueryData<SeededPages>(key)

    first!.pages[0]!.items[0]!.name = 'Renamed in the first client'

    expect(second!.pages[0]!.items[0]!.name).toBe('Payments')
  })
})
