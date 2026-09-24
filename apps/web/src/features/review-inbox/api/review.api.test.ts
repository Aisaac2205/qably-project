import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  approveProposal,
  getInboxCounts,
  getInboxPage,
  getProposal,
  listProposals,
  rejectProposal,
} from './review.api'

const fetchMock = vi.fn()

function lastCall(): [string, RequestInit] {
  return fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [
    string,
    RequestInit,
  ]
}

describe('review.api', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: 'proposal-1' }),
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    fetchMock.mockReset()
  })

  it('lists every proposal in the organization when no filter is given', async () => {
    await listProposals({})

    const [url, init] = lastCall()
    expect(url).toMatch(/\/review\/proposals$/)
    expect(init.method).toBe('GET')
  })

  it('sends only the filters that were set', async () => {
    await listProposals({ projectId: 'proj-1', status: 'in_review' })

    const [url] = lastCall()
    expect(url).toContain('projectId=proj-1')
    expect(url).toContain('status=in_review')
    expect(url).not.toContain('duplicatesOnly')
    expect(url).not.toContain('search')
  })

  it('encodes a search term instead of pasting it raw into the query', async () => {
    await listProposals({ search: 'empty cart & checkout' })

    const [url] = lastCall()
    expect(url).toContain('search=empty+cart+%26+checkout')
  })

  it('sends duplicatesOnly as the string the api validates', async () => {
    await listProposals({ duplicatesOnly: true })

    const [url] = lastCall()
    expect(url).toContain('duplicatesOnly=true')
  })

  it('omits duplicatesOnly when it is false', async () => {
    await listProposals({ duplicatesOnly: false })

    const [url] = lastCall()
    expect(url).not.toContain('duplicatesOnly')
  })

  it('reads one proposal with its evidence', async () => {
    await getProposal('proposal-1')

    const [url, init] = lastCall()
    expect(url).toMatch(/\/review\/proposals\/proposal-1$/)
    expect(init.method).toBe('GET')
  })

  it('approves a proposal with an optional comment', async () => {
    await approveProposal('proposal-1', 'Matches the evidence')

    const [url, init] = lastCall()
    expect(url).toMatch(/\/review\/proposals\/proposal-1\/approve$/)
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ comment: 'Matches the evidence' }))
  })

  it('approves without a comment when none was written', async () => {
    await approveProposal('proposal-1')

    const [, init] = lastCall()
    expect(init.body).toBe(JSON.stringify({}))
  })

  it('rejects a proposal', async () => {
    await rejectProposal('proposal-1', 'The steps do not match')

    const [url, init] = lastCall()
    expect(url).toMatch(/\/review\/proposals\/proposal-1\/reject$/)
    expect(init.method).toBe('POST')
  })

  it('requests a page of the inbox with status, cursor, and limit', async () => {
    await getInboxPage({ status: 'in_review' }, 'cursor-1', 50)

    const [url, init] = lastCall()
    expect(url).toMatch(/\/review\/inbox\?/)
    expect(url).toContain('status=in_review')
    expect(url).toContain('cursor=cursor-1')
    expect(url).toContain('limit=50')
    expect(init.method).toBe('GET')
  })

  it('omits the cursor from the inbox page request when there is none', async () => {
    await getInboxPage({ status: 'all' }, null, 50)

    const [url] = lastCall()
    expect(url).not.toContain('cursor')
  })

  it('sends duplicatesOnly and search on the inbox page request', async () => {
    await getInboxPage(
      { status: 'in_review', duplicatesOnly: true, search: 'cart' },
      null,
      50,
    )

    const [url] = lastCall()
    expect(url).toContain('duplicatesOnly=true')
    expect(url).toContain('search=cart')
  })

  it('requests inbox counts scoped by project and search', async () => {
    await getInboxCounts({ projectId: 'proj-1', search: 'cart' })

    const [url, init] = lastCall()
    expect(url).toMatch(/\/review\/inbox\/counts\?/)
    expect(url).toContain('projectId=proj-1')
    expect(url).toContain('search=cart')
    expect(init.method).toBe('GET')
  })
})
