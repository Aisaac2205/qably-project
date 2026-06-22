import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PipelineList } from '@/features/pipelines/components/pipeline-list'
import { __resetStore } from '@/lib/mock-store'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

describe('PipelineList', () => {
  beforeEach(() => {
    __resetStore()
  })

  it('shows empty state when no seed pipelines', async () => {
    await act(async () => {
      render(<PipelineList projectId="proj-1" />)
    })
    expect(screen.getByText('No pipeline runs yet')).toBeInTheDocument()
  })

  it('shows empty state for project with no pipelines', async () => {
    await act(async () => {
      render(<PipelineList projectId="proj-4" />)
    })
    expect(screen.getByText('No pipeline runs yet')).toBeInTheDocument()
  })
})
