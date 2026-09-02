import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApiKey, listApiKeys, revokeApiKey } from './api-keys.api'

const fetchMock = vi.fn()

function lastCall(): [string, RequestInit] {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [
    string,
    RequestInit,
  ]
}

describe('api-keys.api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'key-1' }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('lists the api keys of one project', async () => {
    await listApiKeys('proj-1')

    const [url, init] = lastCall()
    expect(url).toContain('/projects/proj-1/api-keys')
    expect(init.method).toBe('GET')
  })

  it('creates an api key under the project', async () => {
    await createApiKey('proj-1', { name: 'CI/CD Pipeline' })

    const [url, init] = lastCall()
    expect(url).toContain('/projects/proj-1/api-keys')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ name: 'CI/CD Pipeline' })
  })

  it('revokes an api key with a POST to its revoke sub-path', async () => {
    await revokeApiKey('proj-1', 'key-1')

    const [url, init] = lastCall()
    expect(url).toContain('/projects/proj-1/api-keys/key-1/revoke')
    expect(init.method).toBe('POST')
  })

  it('never sends the key id as a query string on revoke', async () => {
    await revokeApiKey('proj-1', 'key-1')

    const [url] = lastCall()
    expect(url).not.toContain('?')
  })
})
