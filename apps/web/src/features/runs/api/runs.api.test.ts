import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRun, getRun, listRuns, updateRunCase } from './runs.api'

const fetchMock = vi.fn()

function lastCall(): [string, RequestInit] {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [
    string,
    RequestInit,
  ]
}

describe('runs.api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'run-1' }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('lists the runs of one project', async () => {
    await listRuns({ projectId: 'proj-1' })

    const [url, init] = lastCall()
    expect(url).toContain('/runs?projectId=proj-1')
    expect(init.method).toBe('GET')
  })

  it('lists every run in the organization when no project is given', async () => {
    await listRuns()

    const [url] = lastCall()
    expect(url).toMatch(/\/runs$/)
  })

  it('escapes a project id that would otherwise break the query string', async () => {
    await listRuns({ projectId: 'proj/1&x=2' })

    expect(lastCall()[0]).toContain('/runs?projectId=proj%2F1%26x%3D2')
  })

  it('asks for one page when a limit is given', async () => {
    await listRuns({ projectId: 'proj-1', limit: 25 })

    expect(lastCall()[0]).toContain('projectId=proj-1&limit=25')
  })

  it('resumes from a cursor', async () => {
    await listRuns({ projectId: 'proj-1', limit: 25, cursor: 'run-9' })

    expect(lastCall()[0]).toContain('cursor=run-9')
  })

  it('narrows to one source', async () => {
    await listRuns({ projectId: 'proj-1', source: 'github_actions' })

    expect(lastCall()[0]).toContain('source=github_actions')
  })

  it('omits a filter that was not provided', async () => {
    await listRuns({ projectId: 'proj-1' })

    const [url] = lastCall()
    expect(url).not.toContain('limit=')
    expect(url).not.toContain('cursor=')
    expect(url).not.toContain('source=')
  })

  it('reads a single run', async () => {
    await getRun('run-1')

    expect(lastCall()[0]).toContain('/runs/run-1')
  })

  it('starts a manual run', async () => {
    await createRun({ projectId: 'proj-1', suiteId: 'suite-1', name: 'Smoke' })

    const [url, init] = lastCall()
    expect(url).toContain('/runs')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({
      projectId: 'proj-1',
      suiteId: 'suite-1',
      name: 'Smoke',
    })
  })

  it('records a case result', async () => {
    await updateRunCase('run-1', 'case-1', { status: 'pass' })

    const [url, init] = lastCall()
    expect(url).toContain('/runs/run-1/cases/case-1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ status: 'pass' })
  })
})
