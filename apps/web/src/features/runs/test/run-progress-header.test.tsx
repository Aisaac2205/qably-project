import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { RunProgressHeader } from '@/features/runs/components/run-progress-header'
import type { Run } from '@qably/types'

const mockRun: Run = {
  id: 'run-12',
  projectId: 'proj-1',
  name: 'Run #12',
  suiteId: 'suite-1',
  suiteName: 'Authentication',
  status: 'running',
  passRate: 33,
  source: 'manual',
  startedAt: '2026-06-16T10:00:00Z',
  finishedAt: '2026-06-16T10:05:00Z',
  cases: [],
}

describe('RunProgressHeader', () => {
  it('renders run name', async () => {
    await act(async () => {
      render(<RunProgressHeader run={mockRun} />)
    })
    expect(screen.getByText('Run #12')).toBeInTheDocument()
  })

  it('renders suite name', async () => {
    await act(async () => {
      render(<RunProgressHeader run={mockRun} />)
    })
    expect(screen.getByText('Authentication')).toBeInTheDocument()
  })

  it('renders pass rate in mono font', async () => {
    await act(async () => {
      render(<RunProgressHeader run={mockRun} />)
    })
    const passRate = screen.getByText('33%')
    expect(passRate).toBeInTheDocument()
    expect(passRate.className).toContain('font-mono')
  })

  it('renders status chip', async () => {
    await act(async () => {
      render(<RunProgressHeader run={mockRun} />)
    })
    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it('renders source label', async () => {
    await act(async () => {
      render(<RunProgressHeader run={mockRun} />)
    })
    // Source is rendered as a human-readable label: manual → Manual
    expect(screen.getByText('Manual')).toBeInTheDocument()
  })

  it('renders dates', async () => {
    await act(async () => {
      render(<RunProgressHeader run={mockRun} />)
    })
    // Should show started/finished text
    expect(screen.getByText(/Started/)).toBeInTheDocument()
    expect(screen.getByText(/Finished/)).toBeInTheDocument()
  })
})
