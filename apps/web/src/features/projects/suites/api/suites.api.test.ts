import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createCase,
  createSuite,
  deleteCase,
  deleteSuite,
  getSuite,
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
})
