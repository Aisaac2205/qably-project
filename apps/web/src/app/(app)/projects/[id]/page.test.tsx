import { describe, it, expect, vi, beforeEach } from 'vitest'
import { redirect } from 'next/navigation'
import ProjectDetailPage from '@/app/(app)/projects/[id]/page'

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

describe('ProjectDetailPage', () => {
  beforeEach(() => {
    vi.mocked(redirect).mockClear()
  })

  it('redirects to the repository tab, the first entry of the project sidebar', async () => {
    await ProjectDetailPage({ params: Promise.resolve({ id: 'proj-1' }) })

    expect(redirect).toHaveBeenCalledWith('/projects/proj-1/repository')
  })

  it('keeps the project id it was given', async () => {
    await ProjectDetailPage({ params: Promise.resolve({ id: 'cmtl59l5r0001h8o8g0le64xa' }) })

    expect(redirect).toHaveBeenCalledWith(
      '/projects/cmtl59l5r0001h8o8g0le64xa/repository',
    )
  })
})
