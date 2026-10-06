import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetSuitesStub,
  createSuite,
  deleteSuite,
  listSuiteSummaries,
  listSuiteTags,
} from '@/test/suites-api-stub'

beforeEach(() => {
  __resetSuitesStub()
})

describe('listSuiteSummaries', () => {
  it('serves the fixture suites of a project as summaries, most recent first', async () => {
    const page = await listSuiteSummaries({ projectId: 'proj-1', sort: 'recent' })

    expect(
      page.items.map(({ id, status, recentPassRate, caseCount }) => ({
        id,
        status,
        recentPassRate,
        caseCount,
      })),
    ).toEqual([
      { id: 'suite-4', status: 'never-run', recentPassRate: null, caseCount: 0 },
      { id: 'suite-3', status: 'never-run', recentPassRate: null, caseCount: 1 },
      { id: 'suite-2', status: 'needs-attention', recentPassRate: 50, caseCount: 3 },
      { id: 'suite-1', status: 'running', recentPassRate: 100, caseCount: 3 },
    ])
    expect(page.nextCursor).toBeNull()
  })

  it('applies the sort and the filters of the call', async () => {
    const page = await listSuiteSummaries({
      projectId: 'proj-1',
      sort: 'name',
      status: 'never-run',
    })

    expect(page.items.map((item) => item.id)).toEqual(['suite-4', 'suite-3'])
  })

  it('serves nothing for a project that has no suites', async () => {
    await expect(listSuiteSummaries({ projectId: 'proj-9', sort: 'recent' })).resolves.toEqual({
      items: [],
      nextCursor: null,
    })
  })

  it('follows the suites created and deleted through the stub', async () => {
    const created = await createSuite({ projectId: 'proj-1', name: 'Fresh' })
    await deleteSuite('suite-1')

    const page = await listSuiteSummaries({ projectId: 'proj-1', sort: 'name' })
    const fresh = page.items.find((item) => item.id === created.id)

    expect(page.items.map((item) => item.id)).not.toContain('suite-1')
    expect(fresh).toMatchObject({
      name: 'Fresh',
      caseCount: 0,
      status: 'never-run',
      recentPassRate: null,
      createdAt: '2026-01-25T00:00:00.000Z',
    })
  })

  it('fails the request when the cursor is not one the stub issued', async () => {
    await expect(
      listSuiteSummaries({ projectId: 'proj-1', sort: 'recent', cursor: 'nope' }),
    ).rejects.toThrow(/cursor/i)
  })
})

describe('listSuiteTags', () => {
  it('lists the distinct tags of the project suites', async () => {
    await expect(listSuiteTags('proj-1')).resolves.toEqual({
      items: [
        'account',
        'auth',
        'checkout',
        'e2e',
        'payments',
        'profile',
        'regression',
        'security',
        'smoke',
      ],
    })
  })

  it('follows the suites created through the stub', async () => {
    await createSuite({ projectId: 'proj-1', name: 'Fresh', tags: ['new'] })

    const facet = await listSuiteTags('proj-1')

    expect(facet.items).toContain('new')
  })

  it('lists nothing for a project that has no suites', async () => {
    await expect(listSuiteTags('proj-9')).resolves.toEqual({ items: [] })
  })
})
