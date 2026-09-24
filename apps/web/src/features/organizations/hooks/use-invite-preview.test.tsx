import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { InvitePreviewRecord } from '@qably/types'
import { useInvitePreview } from './use-invite-preview'
import { previewInvite } from '../api/invites.api'

vi.mock('../api/invites.api', () => ({ previewInvite: vi.fn() }))

const preview = vi.mocked(previewInvite)

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

const record: InvitePreviewRecord = {
  organizationName: 'Acme QA',
  inviterName: 'Ada Lovelace',
  email: 'new@acme.test',
  role: 'member',
  status: 'pending',
}

beforeEach(() => {
  vi.clearAllMocks()
  preview.mockResolvedValue(record)
})

describe('useInvitePreview', () => {
  it('previews the invite for the given token', async () => {
    const { result } = renderHook(() => useInvitePreview('tok123'), { wrapper })

    await waitFor(() => expect(result.current.preview).toEqual(record))
    expect(preview).toHaveBeenCalledWith('tok123')
  })

  it('surfaces the failure instead of pretending the invite is valid', async () => {
    preview.mockRejectedValue(new Error('not found'))

    const { result } = renderHook(() => useInvitePreview('bad-token'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.preview).toBeUndefined()
  })
})
