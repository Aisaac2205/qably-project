import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getDashboardChannels,
  getDashboardOverview,
  getDashboardSummary,
} from './dashboard.api'

const fetchMock = vi.fn()

function lastCall(): [string, RequestInit] {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [
    string,
    RequestInit,
  ]
}

describe('dashboard.api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ totalProjects: 4 }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('reads the organization-wide summary when no project is given', async () => {
    await getDashboardSummary()

    const [url, init] = lastCall()
    expect(url).toMatch(/\/dashboard\/summary$/)
    expect(init.method).toBe('GET')
  })

  it('scopes the summary to one project', async () => {
    await getDashboardSummary('proj-1')

    const [url] = lastCall()
    expect(url).toContain('/dashboard/summary?projectId=proj-1')
  })

  it('escapes a project id that would otherwise break the query string', async () => {
    await getDashboardSummary('proj/1&x=2')

    expect(lastCall()[0]).toContain(
      '/dashboard/summary?projectId=proj%2F1%26x%3D2',
    )
  })

  it('requests the overview with period and tz', async () => {
    await getDashboardOverview(30, 'America/Guatemala')

    const [url, init] = lastCall()
    expect(url).toContain('/dashboard/overview?')
    expect(url).toContain('period=30')
    expect(url).toContain('tz=America%2FGuatemala')
    expect(init.method).toBe('GET')
  })

  it('scopes the overview to one project', async () => {
    await getDashboardOverview(7, 'UTC', 'proj-1')

    expect(lastCall()[0]).toContain('projectId=proj-1')
  })

  it('omits projectId from the overview query when not given', async () => {
    await getDashboardOverview(7, 'UTC')

    expect(lastCall()[0]).not.toContain('projectId')
  })

  it('requests channels with tz', async () => {
    await getDashboardChannels('Asia/Tokyo')

    const [url, init] = lastCall()
    expect(url).toContain('/dashboard/channels?')
    expect(url).toContain('tz=Asia%2FTokyo')
    expect(init.method).toBe('GET')
  })
})
