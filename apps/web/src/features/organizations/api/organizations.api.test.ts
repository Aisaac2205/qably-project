import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listOrganizations } from './organizations.api'
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
})
