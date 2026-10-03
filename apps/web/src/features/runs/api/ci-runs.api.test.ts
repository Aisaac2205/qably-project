import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CiRunsPageRecord } from '@qably/types'
import { ApiError } from '@/lib/api-client'
import { ciRunKeys, runKeys } from '../lib/query-keys'
import { getCiRun, listCiRuns } from './ci-runs.api'

const fetchMock = vi.fn()

function lastCall(): [string, RequestInit] {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [
    string,
    RequestInit,
  ]
}

function failWith(status: number, body: Record<string, unknown>): void {
  fetchMock.mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  })
}

describe('ci-runs.api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ items: [] }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('lists the CI runs of one project', async () => {
    await listCiRuns({ projectId: 'proj-1' })

    const [url, init] = lastCall()
    expect(url).toMatch(/\/ci-runs\?projectId=proj-1$/)
    expect(init.method).toBe('GET')
  })

  it('asks for one page and resumes from a cursor', async () => {
    await listCiRuns({ projectId: 'proj-1', limit: 25, cursor: 'ci-9' })

    const { pathname, searchParams } = new URL(lastCall()[0])
    expect(pathname).toBe('/ci-runs')
    expect(searchParams.get('projectId')).toBe('proj-1')
    expect(searchParams.get('limit')).toBe('25')
    expect(searchParams.get('cursor')).toBe('ci-9')
  })

  it('leaves out a limit or cursor that is undefined', async () => {
    await listCiRuns({ projectId: 'proj-1', limit: undefined, cursor: undefined })

    const [url] = lastCall()
    expect(url).toMatch(/\/ci-runs\?projectId=proj-1$/)
    expect(url).not.toContain('undefined')
  })

  it('escapes a project id that would otherwise break the query string', async () => {
    await listCiRuns({ projectId: 'proj/1&x=2' })

    expect(lastCall()[0]).toContain('/ci-runs?projectId=proj%2F1%26x%3D2')
  })

  it('returns the page the api served', async () => {
    const page: CiRunsPageRecord = {
      items: [
        {
          id: 'ci-1',
          projectId: 'proj-1',
          source: 'github_actions',
          externalId: '900',
          status: 'failing',
          startedAt: '2026-10-03T10:00:00.000Z',
          lastReportedAt: '2026-10-03T10:12:20.000Z',
        },
      ],
      nextCursor: 'ci-1',
    }
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(page) })

    await expect(listCiRuns({ projectId: 'proj-1' })).resolves.toEqual(page)
  })

  it('hands the abort signal to the request', async () => {
    const controller = new AbortController()

    await listCiRuns({ projectId: 'proj-1' }, controller.signal)

    expect(lastCall()[1].signal).toBe(controller.signal)
  })

  it('reads one CI run by id', async () => {
    await getCiRun('ci-1')

    const [url, init] = lastCall()
    expect(url).toMatch(/\/ci-runs\/ci-1$/)
    expect(init.method).toBe('GET')
  })

  it('encodes an id that would otherwise change the path', async () => {
    await getCiRun('ci/1?x=2')

    expect(lastCall()[0]).toMatch(/\/ci-runs\/ci%2F1%3Fx%3D2$/)
  })

  it('hands the abort signal to the detail request', async () => {
    const controller = new AbortController()

    await getCiRun('ci-1', controller.signal)

    expect(lastCall()[1].signal).toBe(controller.signal)
  })

  it('keeps the 404 status so the screen can say the run was not found', async () => {
    failWith(404, { statusCode: 404, code: 'not-found', message: 'CI run not found' })

    const failure = await getCiRun('ci-missing').catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ApiError)
    expect(failure).toMatchObject({ status: 404, code: 'not-found' })
  })

  it('keeps any other failure status instead of folding it into not found', async () => {
    failWith(500, { statusCode: 500, message: 'Internal server error' })

    const failure = await getCiRun('ci-1').catch((error: unknown) => error)

    expect(failure).toBeInstanceOf(ApiError)
    expect(failure).toMatchObject({ status: 500 })
  })

  it('keeps the failure status of the list too', async () => {
    failWith(400, { statusCode: 400, message: 'projectId is required' })

    const failure = await listCiRuns({ projectId: '' }).catch((error: unknown) => error)

    expect(failure).toMatchObject({ status: 400 })
  })
})

describe('ciRunKeys', () => {
  it('keys one page list per project', () => {
    expect(ciRunKeys.page('proj-1')).toEqual(['ci-runs', 'page', 'proj-1'])
    expect(ciRunKeys.page('proj-2')).toEqual(['ci-runs', 'page', 'proj-2'])
  })

  it('keys one detail per CI run', () => {
    expect(ciRunKeys.detail('ci-1')).toEqual(['ci-runs', 'detail', 'ci-1'])
    expect(ciRunKeys.detail('ci-2')).toEqual(['ci-runs', 'detail', 'ci-2'])
  })

  it('shares one root so every CI run query can be invalidated together', () => {
    expect(ciRunKeys.all).toEqual(['ci-runs'])
    expect(ciRunKeys.page('proj-1').slice(0, 1)).toEqual(ciRunKeys.all)
    expect(ciRunKeys.detail('ci-1').slice(0, 1)).toEqual(ciRunKeys.all)
  })

  it('never shares a root with the suite run keys', () => {
    expect(ciRunKeys.all[0]).not.toBe(runKeys.all[0])
  })
})
