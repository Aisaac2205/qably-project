import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { getProjectRepository } from './repository.api'

const fetchMock = vi.fn()

describe('getProjectRepository', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ source: null, batch: null, codeChanges: [], evidence: [] }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('reads the repository view scoped to the project', async () => {
    const view = await getProjectRepository('proj-1')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/projects/proj-1/repository'),
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
    expect(view).toEqual({ source: null, batch: null, codeChanges: [], evidence: [] })
  })

  it('forwards the abort signal', async () => {
    const controller = new AbortController()

    await getProjectRepository('proj-1', controller.signal)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    )
  })
})
