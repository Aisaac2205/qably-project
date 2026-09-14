import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDuplicateCandidates } from './duplicates.api'

const fetchMock = vi.fn()

function lastCall(): [string, RequestInit] {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [
    string,
    RequestInit,
  ]
}

describe('duplicates.api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('reads the ranked duplicates for a proposal', async () => {
    await getDuplicateCandidates('proposal-1')

    const [url, init] = lastCall()
    expect(url).toMatch(/\/review\/proposals\/proposal-1\/duplicates$/)
    expect(init.method).toBe('GET')
  })
})
