import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest } from './api-client'
import { DEFAULT_LOCALE, useI18nStore } from './i18n/store'

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  const spy = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve({}),
    ...response,
  })
  vi.stubGlobal('fetch', spy)
  return spy
}

afterEach(() => {
  vi.unstubAllGlobals()
  useI18nStore.getState().setLocale(DEFAULT_LOCALE)
})

describe('apiRequest', () => {
  it('prefixes the path with the configured api origin', async () => {
    const spy = mockFetch({ json: () => Promise.resolve([]) })

    await apiRequest('/projects')

    expect(spy).toHaveBeenCalledWith(
      'http://localhost:3001/projects',
      expect.anything(),
    )
  })

  it('sends the session cookie on every request', async () => {
    const spy = mockFetch({ json: () => Promise.resolve([]) })

    await apiRequest('/projects')

    expect(spy.mock.calls[0][1]).toMatchObject({ credentials: 'include' })
  })

  it('serialises the body as json and sets the content type', async () => {
    const spy = mockFetch({ json: () => Promise.resolve({}) })

    await apiRequest('/projects', { method: 'POST', body: { name: 'Shop' } })

    const init = spy.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"name":"Shop"}')
    expect(new Headers(init.headers).get('content-type')).toBe('application/json')
  })

  it('returns the parsed json payload', async () => {
    mockFetch({ json: () => Promise.resolve([{ id: 'p1' }]) })

    await expect(apiRequest('/projects')).resolves.toEqual([{ id: 'p1' }])
  })

  it('returns undefined for a 204 response', async () => {
    mockFetch({ status: 204, headers: new Headers() })

    await expect(apiRequest('/projects/p1', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('throws an ApiError carrying the status for a failed request', async () => {
    mockFetch({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ message: 'Project not found' }),
    })

    await expect(apiRequest('/projects/nope')).rejects.toMatchObject({
      status: 404,
      message: 'Project not found',
    })
  })

  it('falls back to a generic message when the error body has none', async () => {
    mockFetch({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    })

    await expect(apiRequest('/projects')).rejects.toBeInstanceOf(ApiError)
  })

  it('carries a machine-readable code from the error body', async () => {
    mockFetch({
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({ statusCode: 409, code: 'no-manual-cases', message: 'no manual cases' }),
    })

    await expect(apiRequest('/runs')).rejects.toMatchObject({
      status: 409,
      code: 'no-manual-cases',
      message: 'no manual cases',
    })
  })

  it('leaves code undefined when the error body has none', async () => {
    mockFetch({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: 'boom' }),
    })

    await expect(apiRequest('/runs')).rejects.toMatchObject({ code: undefined })
  })

  it('forwards the organization header when one is given', async () => {
    const spy = mockFetch({ json: () => Promise.resolve([]) })

    await apiRequest('/projects', { organizationId: 'org-1' })

    const init = spy.mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).get('x-organization-id')).toBe('org-1')
  })

  it('sends the current UI locale as Accept-Language', async () => {
    useI18nStore.getState().setLocale('es')
    const spy = mockFetch({ json: () => Promise.resolve([]) })

    await apiRequest('/projects')

    const init = spy.mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).get('accept-language')).toBe('es')
  })
})
