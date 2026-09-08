import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updateMyLocale } from './settings.api'
import { apiRequest } from '@/lib/api-client'

vi.mock('@/lib/api-client', () => ({ apiRequest: vi.fn() }))

const request = vi.mocked(apiRequest)

beforeEach(() => {
  request.mockReset()
  request.mockResolvedValue({ locale: 'es' })
})

describe('updateMyLocale', () => {
  it('sends the chosen locale as a PATCH to /me', async () => {
    await updateMyLocale('es')

    expect(request).toHaveBeenCalledWith('/me', {
      method: 'PATCH',
      body: { locale: 'es' },
    })
  })

  it('resolves with the updated user', async () => {
    await expect(updateMyLocale('es')).resolves.toEqual({ locale: 'es' })
  })
})
