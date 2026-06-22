import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PipelineRow } from '@/features/pipelines/components/pipeline-row'
import type { PipelineRun } from '@qably/types'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

const mockPipeline: PipelineRun = {
  id: 'pipe-1',
  projectId: 'proj-1',
  branch: 'main',
  commitSha: 'a3f8c21e',
  commitMessage: 'feat: add discount code validation',
  status: 'pass',
  runId: 'run-9',
  triggeredAt: '2026-06-13T11:00:00Z',
  finishedAt: '2026-06-13T11:08:00Z',
}

describe('PipelineRow', () => {
  it('renders branch name', async () => {
    await act(async () => {
      render(<PipelineRow p={mockPipeline} projectId="proj-1" />)
    })
    expect(screen.getByText('main')).toBeInTheDocument()
  })

  it('renders short commit SHA in mono', async () => {
    await act(async () => {
      render(<PipelineRow p={mockPipeline} projectId="proj-1" />)
    })
    const sha = screen.getByText('a3f8c21')
    expect(sha).toBeInTheDocument()
    expect(sha.className).toContain('font-mono')
  })

  it('renders commit message', async () => {
    await act(async () => {
      render(<PipelineRow p={mockPipeline} projectId="proj-1" />)
    })
    expect(screen.getByText('feat: add discount code validation')).toBeInTheDocument()
  })

  it('renders status chip', async () => {
    await act(async () => {
      render(<PipelineRow p={mockPipeline} projectId="proj-1" />)
    })
    expect(screen.getByText('Pass')).toBeInTheDocument()
  })

  it('renders runId as link when present', async () => {
    await act(async () => {
      render(<PipelineRow p={mockPipeline} projectId="proj-1" />)
    })
    const link = screen.getByText('run-9')
    expect(link.tagName).toBe('A')
    expect(link.getAttribute('href')).toBe('/projects/proj-1/runs/run-9')
  })

  it('renders dash when runId is absent', async () => {
    const noRun: PipelineRun = { ...mockPipeline, runId: undefined }
    await act(async () => {
      render(<PipelineRow p={noRun} projectId="proj-1" />)
    })
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders relative started time', async () => {
    await act(async () => {
      render(<PipelineRow p={mockPipeline} projectId="proj-1" />)
    })
    const texts = document.body.textContent ?? ''
    expect(texts).toMatch(/\d+[mhd] ago/)
  })
})
