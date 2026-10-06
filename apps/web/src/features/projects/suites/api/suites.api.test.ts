import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  confirmDocumentation,
  createCase,
  createSuite,
  deleteCase,
  deleteSuite,
  documentCase,
  documentProject,
  documentSuite,
  getSuite,
  listSuiteSummaries,
  listSuiteTags,
  listSuites,
  updateCase,
  updateSuite,
} from './suites.api'

const fetchMock = vi.fn()

function lastCall(): [string, RequestInit] {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [
    string,
    RequestInit,
  ]
}

function lastRequest(): { path: string; params: Record<string, string>; init: RequestInit } {
  const [url, init] = lastCall()
  const parsed = new URL(url)

  return {
    path: parsed.pathname,
    params: Object.fromEntries(parsed.searchParams),
    init,
  }
}

describe('suites.api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'suite-1' }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('lists the suites of one project', async () => {
    await listSuites('proj-1')

    const [url, init] = lastCall()
    expect(url).toContain('/suites?projectId=proj-1')
    expect(init.method).toBe('GET')
  })

  it('lists every suite when no project is given', async () => {
    await listSuites()

    const [url] = lastCall()
    expect(url).toMatch(/\/suites$/)
  })

  it('escapes a project id that would otherwise break the query string', async () => {
    await listSuites('proj/1&x=2')

    expect(lastCall()[0]).toContain('/suites?projectId=proj%2F1%26x%3D2')
  })

  it('reads a single suite', async () => {
    await getSuite('suite-1')

    expect(lastCall()[0]).toContain('/suites/suite-1')
  })

  it('creates a suite', async () => {
    await createSuite({ projectId: 'proj-1', name: 'Checkout' })

    const [url, init] = lastCall()
    expect(url).toContain('/suites')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      projectId: 'proj-1',
      name: 'Checkout',
    })
  })

  it('updates a suite', async () => {
    await updateSuite('suite-1', { name: 'Renamed' })

    const [url, init] = lastCall()
    expect(url).toContain('/suites/suite-1')
    expect(init.method).toBe('PATCH')
  })

  it('deletes a suite', async () => {
    await deleteSuite('suite-1')

    expect(lastCall()[1].method).toBe('DELETE')
  })

  it('adds a case under its suite', async () => {
    await createCase('suite-1', { name: 'Empty cart' })

    const [url, init] = lastCall()
    expect(url).toContain('/suites/suite-1/cases')
    expect(init.method).toBe('POST')
  })

  it('updates a case under its suite', async () => {
    await updateCase('suite-1', 'case-1', { priority: 'high' })

    const [url, init] = lastCall()
    expect(url).toContain('/suites/suite-1/cases/case-1')
    expect(init.method).toBe('PATCH')
  })

  it('removes a case under its suite', async () => {
    await deleteCase('suite-1', 'case-1')

    const [url, init] = lastCall()
    expect(url).toContain('/suites/suite-1/cases/case-1')
    expect(init.method).toBe('DELETE')
  })

  it('documents a single case under its suite', async () => {
    await documentCase('suite-1', 'case-1')

    const [url, init] = lastCall()
    expect(url).toContain('/suites/suite-1/cases/case-1/document')
    expect(init.method).toBe('POST')
  })

  it('sends the document mode as a plain JSON object, not a doubly-encoded string', async () => {
    await documentSuite('suite-1', 'stale-locale')

    const [url, init] = lastCall()
    expect(url).toContain('/suites/suite-1/document')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"mode":"stale-locale"}')
  })

  it('confirms the documentation of one suite', async () => {
    await confirmDocumentation('suite-1')

    const [url, init] = lastCall()
    expect(url).toContain('/suites/suite-1/confirm-documentation')
    expect(init.method).toBe('POST')
    expect(init.body).toBeUndefined()
  })

  it('sends the selected case ids as a plain JSON object', async () => {
    await confirmDocumentation('suite-1', ['case-1', 'case-2'])

    const [, init] = lastCall()
    expect(init.body).toBe('{"caseIds":["case-1","case-2"]}')
  })

  it('sends the project document mode as a plain JSON object, not a doubly-encoded string', async () => {
    await documentProject('proj-1', 'undocumented')

    const [url, init] = lastCall()
    expect(url).toContain('/projects/proj-1/document')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"mode":"undocumented"}')
    expect(JSON.parse(init.body as string)).toEqual({ mode: 'undocumented' })
  })

  describe('listSuiteSummaries', () => {
    it('asks the summaries route for the project and sort alone when nothing else is set', async () => {
      await listSuiteSummaries({ projectId: 'proj-1', sort: 'recent' })

      const { path, params, init } = lastRequest()
      expect(path).toBe('/suites/summaries')
      expect(init.method).toBe('GET')
      expect(params).toEqual({ projectId: 'proj-1', sort: 'recent' })
    })

    it('sends every filter, the cursor and the limit when they are set', async () => {
      await listSuiteSummaries({
        projectId: 'proj-1',
        sort: 'pass-rate',
        search: 'checkout',
        status: 'needs-attention',
        tag: 'api',
        cursor: 'opaque-cursor',
        limit: 50,
      })

      expect(lastRequest().params).toEqual({
        projectId: 'proj-1',
        sort: 'pass-rate',
        search: 'checkout',
        status: 'needs-attention',
        tag: 'api',
        cursor: 'opaque-cursor',
        limit: '50',
      })
    })

    it('trims the search before sending it', async () => {
      await listSuiteSummaries({ projectId: 'proj-1', sort: 'recent', search: '  abc ' })

      expect(lastRequest().params.search).toBe('abc')
    })

    it.each([
      ['an empty search', { search: '' }],
      ['a whitespace search', { search: '   ' }],
      ['an empty tag', { tag: '' }],
      ['an empty cursor', { cursor: '' }],
    ])('leaves %s out of the query string', async (_label, extra) => {
      await listSuiteSummaries({ projectId: 'proj-1', sort: 'name', ...extra })

      expect(lastRequest().params).toEqual({ projectId: 'proj-1', sort: 'name' })
    })

    it('escapes values that would otherwise break the query string', async () => {
      await listSuiteSummaries({
        projectId: 'proj/1&x=2',
        sort: 'recent',
        search: '100% & more',
        tag: 'a=b',
      })

      const { params } = lastRequest()
      expect(params.projectId).toBe('proj/1&x=2')
      expect(params.search).toBe('100% & more')
      expect(params.tag).toBe('a=b')
      expect(lastCall()[0]).toContain('projectId=proj%2F1%26x%3D2')
    })

    it('escapes a hash so it never starts a fragment', async () => {
      await listSuiteSummaries({
        projectId: 'proj-1',
        sort: 'recent',
        search: 'issue #42',
        tag: '#smoke',
        cursor: 'abc#def',
      })

      const [url] = lastCall()
      expect(new URL(url).hash).toBe('')
      expect(url).toContain('search=issue+%2342')
      expect(url).toContain('tag=%23smoke')
      expect(url).toContain('cursor=abc%23def')
      expect(lastRequest().params).toMatchObject({
        search: 'issue #42',
        tag: '#smoke',
        cursor: 'abc#def',
      })
    })

    it('encodes non-ASCII values as UTF-8 and reads them back unchanged', async () => {
      await listSuiteSummaries({
        projectId: 'proj-1',
        sort: 'name',
        search: 'árbol ñandú',
        tag: '日本',
      })

      const [url] = lastCall()
      expect(url).toContain('search=%C3%A1rbol+%C3%B1and%C3%BA')
      expect(url).toContain('tag=%E6%97%A5%E6%9C%AC')
      expect(lastRequest().params).toMatchObject({ search: 'árbol ñandú', tag: '日本' })
    })

    it('hands the abort signal to the request', async () => {
      const controller = new AbortController()

      await listSuiteSummaries({ projectId: 'proj-1', sort: 'recent' }, controller.signal)

      expect(lastRequest().init.signal).toBe(controller.signal)
    })

    it('resolves with the page the server sent', async () => {
      const page = { items: [], nextCursor: 'next-1' }
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(page) })

      await expect(listSuiteSummaries({ projectId: 'proj-1', sort: 'recent' })).resolves.toEqual(page)
    })
  })

  describe('listSuiteTags', () => {
    it('asks the tags route for the tags of one project', async () => {
      await listSuiteTags('proj-1')

      const { path, params, init } = lastRequest()
      expect(path).toBe('/suites/tags')
      expect(init.method).toBe('GET')
      expect(params).toEqual({ projectId: 'proj-1' })
    })

    it('escapes a project id that would otherwise break the query string', async () => {
      await listSuiteTags('proj/1&x=2')

      expect(lastCall()[0]).toContain('/suites/tags?projectId=proj%2F1%26x%3D2')
    })

    it('hands the abort signal to the request', async () => {
      const controller = new AbortController()

      await listSuiteTags('proj-1', controller.signal)

      expect(lastRequest().init.signal).toBe(controller.signal)
    })

    it('resolves with the facet the server sent', async () => {
      const facet = { items: ['C', 'a', 'b'] }
      fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(facet) })

      await expect(listSuiteTags('proj-1')).resolves.toEqual(facet)
    })
  })
})
