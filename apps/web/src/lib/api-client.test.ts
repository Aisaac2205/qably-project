import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest, apiStream } from './api-client'
import { DEFAULT_LOCALE, useI18nStore } from './i18n/store'
import { useActiveOrganizationStore } from '@/stores/active-organization.store'
import { registerQueryClient, resetQueryClientRegistry } from '@/lib/query-client-registry'

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

function notAMemberResponse() {
  return {
    ok: false,
    status: 403,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve({ code: 'not-a-member', message: 'You do not belong to that organization' }),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  useI18nStore.getState().setLocale(DEFAULT_LOCALE)
  useActiveOrganizationStore.setState({ organizationId: null, userId: null })
  resetQueryClientRegistry()
  localStorage.clear()
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

  it('carries structured details from the error body, like a 409 decision payload', async () => {
    const decision = {
      action: 'approved',
      decidedAt: '2026-01-05T12:00:00.000Z',
      decidedBy: { id: 'user-2', name: 'Grace Hopper' },
    }
    mockFetch({
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({
          statusCode: 409,
          code: 'invalid-transition',
          message: 'This proposal was already decided',
          decision,
          path: '/review/proposals/proposal-1/approve',
          timestamp: '2026-01-05T12:00:01.000Z',
        }),
    })

    await expect(apiRequest('/review/proposals/proposal-1/approve')).rejects.toMatchObject({
      status: 409,
      code: 'invalid-transition',
      details: { decision },
    })
  })

  it('leaves details undefined when the error body carries no extra fields', async () => {
    mockFetch({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ message: 'Project not found' }),
    })

    await expect(apiRequest('/projects/nope')).rejects.toMatchObject({ details: undefined })
  })

  it('carries a null value inside details, distinct from the field being absent', async () => {
    mockFetch({
      ok: false,
      status: 409,
      json: () =>
        Promise.resolve({
          code: 'invalid-transition',
          message: 'This proposal was already decided',
          decision: null,
        }),
    })

    await expect(apiRequest('/review/proposals/proposal-1/approve')).rejects.toMatchObject({
      details: { decision: null },
    })
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

  it('injects the active organization when the caller gives no explicit id', async () => {
    useActiveOrganizationStore.getState().setActiveOrganization('org-9', 'user-1')
    const spy = mockFetch({ json: () => Promise.resolve([]) })

    await apiRequest('/projects')

    const init = spy.mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).get('x-organization-id')).toBe('org-9')
  })

  it('lets an explicit organization id win over the active organization', async () => {
    useActiveOrganizationStore.getState().setActiveOrganization('org-9', 'user-1')
    const spy = mockFetch({ json: () => Promise.resolve([]) })

    await apiRequest('/projects', { organizationId: 'org-explicit' })

    const init = spy.mock.calls[0][1] as RequestInit
    expect(new Headers(init.headers).get('x-organization-id')).toBe('org-explicit')
  })

  it('clears the active organization and retries once when the injected header is rejected as not-a-member', async () => {
    useActiveOrganizationStore.getState().setActiveOrganization('org-stale', 'user-1')
    const spy = vi
      .fn()
      .mockResolvedValueOnce(notAMemberResponse())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve([{ id: 'p1' }]),
      })
    vi.stubGlobal('fetch', spy)

    await expect(apiRequest('/projects')).resolves.toEqual([{ id: 'p1' }])

    expect(spy).toHaveBeenCalledTimes(2)
    expect(new Headers((spy.mock.calls[0][1] as RequestInit).headers).get('x-organization-id')).toBe(
      'org-stale',
    )
    expect(new Headers((spy.mock.calls[1][1] as RequestInit).headers).get('x-organization-id')).toBeNull()
    expect(useActiveOrganizationStore.getState().organizationId).toBeNull()
  })

  it('resets a registered query cache when the not-a-member recovery clears the organization, so stale panels cannot keep showing the removed org', async () => {
    const queryClient = new QueryClient()
    const resetSpy = vi.spyOn(queryClient, 'resetQueries').mockResolvedValue(undefined)
    vi.spyOn(queryClient, 'cancelQueries').mockResolvedValue(undefined)
    registerQueryClient(queryClient)

    useActiveOrganizationStore.getState().setActiveOrganization('org-stale', 'user-1')
    const spy = vi
      .fn()
      .mockResolvedValueOnce(notAMemberResponse())
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve([{ id: 'p1' }]),
      })
    vi.stubGlobal('fetch', spy)

    await apiRequest('/projects')

    expect(resetSpy).toHaveBeenCalled()
  })

  it('does not retry a not-a-member 403 when the caller explicitly chose the organization id', async () => {
    const spy = vi.fn().mockResolvedValue(notAMemberResponse())
    vi.stubGlobal('fetch', spy)

    await expect(apiRequest('/projects', { organizationId: 'org-explicit' })).rejects.toMatchObject({
      status: 403,
      code: 'not-a-member',
    })

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does not retry a second time when the retry also comes back not-a-member', async () => {
    useActiveOrganizationStore.getState().setActiveOrganization('org-stale', 'user-1')
    const spy = vi.fn().mockResolvedValue(notAMemberResponse())
    vi.stubGlobal('fetch', spy)

    await expect(apiRequest('/projects')).rejects.toMatchObject({ status: 403, code: 'not-a-member' })

    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('does not retry a 403 that carries a different error code', async () => {
    useActiveOrganizationStore.getState().setActiveOrganization('org-stale', 'user-1')
    const spy = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve({ code: 'forbidden', message: 'nope' }),
    })
    vi.stubGlobal('fetch', spy)

    await expect(apiRequest('/projects')).rejects.toMatchObject({ status: 403, code: 'forbidden' })

    expect(spy).toHaveBeenCalledTimes(1)
    expect(useActiveOrganizationStore.getState().organizationId).toBe('org-stale')
  })

  it('awaits store rehydration before resolving the injected organization header', async () => {
    useActiveOrganizationStore.getState().setActiveOrganization('org-42', 'user-1')
    const originalHasHydrated = useActiveOrganizationStore.persist.hasHydrated
    const originalOnFinishHydration = useActiveOrganizationStore.persist.onFinishHydration
    let finishHydration: (() => void) | undefined

    useActiveOrganizationStore.persist.hasHydrated = () => false
    useActiveOrganizationStore.persist.onFinishHydration = (fn) => {
      finishHydration = () => fn(useActiveOrganizationStore.getState())
      return () => {}
    }

    try {
      const spy = mockFetch({ json: () => Promise.resolve([]) })

      const requestPromise = apiRequest('/projects')
      await Promise.resolve()
      await Promise.resolve()
      expect(spy).not.toHaveBeenCalled()

      finishHydration?.()
      await requestPromise

      const init = spy.mock.calls[0][1] as RequestInit
      expect(new Headers(init.headers).get('x-organization-id')).toBe('org-42')
    } finally {
      useActiveOrganizationStore.persist.hasHydrated = originalHasHydrated
      useActiveOrganizationStore.persist.onFinishHydration = originalOnFinishHydration
    }
  })
})

describe('apiStream', () => {
  function streamOf(text: string): ReadableStream<Uint8Array<ArrayBuffer>> {
    return new ReadableStream<Uint8Array<ArrayBuffer>>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text))
        controller.close()
      },
    })
  }

  it('returns the body of a successful response and asks for an event stream', async () => {
    const body = streamOf('event: delta\ndata: {"text":"Hi"}\n\n')
    const spy = mockFetch({ body, headers: new Headers({ 'content-type': 'text/event-stream' }) })

    await expect(
      apiStream('/projects/p1/chat/threads/t1/messages/stream', {
        method: 'POST',
        body: { content: 'Hello' },
      }),
    ).resolves.toBe(body)

    const [url, init] = spy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('http://localhost:3001/projects/p1/chat/threads/t1/messages/stream')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(init.body).toBe('{"content":"Hello"}')
    expect(new Headers(init.headers).get('accept')).toBe('text/event-stream')
    expect(new Headers(init.headers).get('content-type')).toBe('application/json')
  })

  it('sends the locale and the active organization like apiRequest', async () => {
    useI18nStore.getState().setLocale('es')
    useActiveOrganizationStore.getState().setActiveOrganization('org-9', 'user-1')
    const spy = mockFetch({ body: streamOf('') })

    await apiStream('/stream', { method: 'POST', body: {} })

    const headers = new Headers((spy.mock.calls[0][1] as RequestInit).headers)
    expect(headers.get('accept-language')).toBe('es')
    expect(headers.get('x-organization-id')).toBe('org-9')
  })

  it('forwards the abort signal to fetch', async () => {
    const spy = mockFetch({ body: streamOf('') })
    const controller = new AbortController()

    await apiStream('/stream', { method: 'POST', body: {}, signal: controller.signal })

    expect((spy.mock.calls[0][1] as RequestInit).signal).toBe(controller.signal)
  })

  it('throws the same ApiError as apiRequest when the request fails before streaming', async () => {
    mockFetch({
      ok: false,
      status: 503,
      json: () =>
        Promise.resolve({ statusCode: 503, code: 'provider-unavailable', message: 'Model down' }),
    })

    const failure = apiStream('/stream', { method: 'POST', body: {} })

    await expect(failure).rejects.toBeInstanceOf(ApiError)
    await expect(failure).rejects.toMatchObject({
      status: 503,
      code: 'provider-unavailable',
      message: 'Model down',
    })
  })

  it('clears the active organization and retries once on not-a-member, like apiRequest', async () => {
    useActiveOrganizationStore.getState().setActiveOrganization('org-stale', 'user-1')
    const body = streamOf('')
    const spy = vi
      .fn()
      .mockResolvedValueOnce(notAMemberResponse())
      .mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers(), body })
    vi.stubGlobal('fetch', spy)

    await expect(apiStream('/stream', { method: 'POST', body: {} })).resolves.toBe(body)

    expect(spy).toHaveBeenCalledTimes(2)
    expect(new Headers((spy.mock.calls[1][1] as RequestInit).headers).get('x-organization-id')).toBeNull()
    expect(useActiveOrganizationStore.getState().organizationId).toBeNull()
  })

  it('throws an ApiError when a successful response carries no body to stream', async () => {
    mockFetch({ body: null })

    await expect(apiStream('/stream', { method: 'POST', body: {} })).rejects.toBeInstanceOf(ApiError)
  })
})
