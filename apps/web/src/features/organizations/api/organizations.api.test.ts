import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getUsage, listOrganizations } from './organizations.api'
import { apiRequest } from '@/lib/api-client'

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))

const request = vi.mocked(apiRequest)

beforeEach(() => {
  request.mockReset()
  request.mockResolvedValue(undefined)
})

describe('organizations api', () => {
  it('lists organizations from the collection route', async () => {
    await listOrganizations()

    expect(request).toHaveBeenCalledWith('/organizations', expect.anything())
  })

  it('reads plan usage from the current organization usage route', async () => {
    await getUsage()

    expect(request).toHaveBeenCalledWith('/organizations/current/usage', expect.anything())
  })
})
