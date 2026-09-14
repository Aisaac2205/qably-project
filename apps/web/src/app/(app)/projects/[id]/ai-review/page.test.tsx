import { describe, it, expect, vi, beforeEach } from 'vitest'
import { redirect } from 'next/navigation'
import AiReviewRoute from '@/app/(app)/projects/[id]/ai-review/page'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

describe('AiReviewRoute', () => {
  beforeEach(() => {
    vi.mocked(redirect).mockClear()
  })

  it('redirects to the project chat full-page route', async () => {
    await AiReviewRoute({ params: Promise.resolve({ id: 'proj-1' }) })

    expect(redirect).toHaveBeenCalledWith('/projects/proj-1/aeris')
  })
})
