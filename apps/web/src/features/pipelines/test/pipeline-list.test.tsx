import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('renders pipelines for a project', async () => {
    await act(async () => {
      render(<PipelineList projectId="proj-1" />)
    })
    // proj-1 has 3 pipelines
    expect(screen.getByText('feat: add discount code validation')).toBeInTheDocument()
    expect(screen.getByText('fix: checkout button not disabling on empty cart')).toBeInTheDocument()
    expect(screen.getByText('chore: update dependencies')).toBeInTheDocument()
  })

  it('renders status chips', async () => {
    await act(async () => {
      render(<PipelineList projectId="proj-1" />)
    })
    // Filter labels duplicate status chip names — use getAllByText
    expect(screen.getAllByText('Pass').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Fail').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Running').length).toBeGreaterThanOrEqual(1)
  })

  it('shows empty state for project with no pipelines', async () => {
    await act(async () => {
      render(<PipelineList projectId="proj-4" />)
    })
    expect(screen.getByText('No pipeline runs yet')).toBeInTheDocument()
  })

  it('filters by status', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<PipelineList projectId="proj-1" />)
    })
    // Uncheck "Fail" and "Running", leaving only "Pass"
    const failCheckbox = screen.getByLabelText('Fail')
    const runningCheckbox = screen.getByLabelText('Running')
    await user.click(failCheckbox)
    await user.click(runningCheckbox)

    // Only pass pipeline should remain
    expect(screen.getByText('feat: add discount code validation')).toBeInTheDocument()
    expect(screen.queryByText('fix: checkout button not disabling on empty cart')).not.toBeInTheDocument()
    expect(screen.queryByText('chore: update dependencies')).not.toBeInTheDocument()
  })

  it('shows empty filter state when nothing matches', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<PipelineList projectId="proj-1" />)
    })
    // Uncheck all
    const all = screen.getByLabelText('All')
    await user.click(all)
    expect(screen.getByText('No pipelines match the selected filters')).toBeInTheDocument()
  })

  it('shows runId links in pipeline rows', async () => {
    await act(async () => {
      render(<PipelineList projectId="proj-1" />)
    })
    const runLink = screen.getByText('run-9')
    expect(runLink.getAttribute('href')).toBe('/projects/proj-1/runs/run-9')
  })
})
