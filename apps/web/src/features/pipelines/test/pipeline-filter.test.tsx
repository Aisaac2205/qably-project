import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { PipelineFilter } from '@/features/pipelines/components/pipeline-filter'
import type { PipelineStatus } from '@qably/types'

describe('PipelineFilter', () => {
  it('renders checkboxes for each status', async () => {
    const onChange = () => {}
    await act(async () => {
      render(<PipelineFilter selected={new Set([])} onChange={onChange} />)
    })
    expect(screen.getByText('Pass')).toBeInTheDocument()
    expect(screen.getByText('Fail')).toBeInTheDocument()
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
    expect(screen.getByText('All')).toBeInTheDocument()
  })

  it('toggles status on checkbox click', async () => {
    const user = userEvent.setup()
    let selected = new Set<PipelineStatus>(['pass'])
    const onChange = (next: Set<PipelineStatus>) => { selected = next }
    const { rerender } = await act(async () => {
      return render(<PipelineFilter selected={selected} onChange={onChange} />)
    })
    // Click "Pass" checkbox to uncheck
    const passCheckbox = screen.getByLabelText('Pass')
    await user.click(passCheckbox)
    expect(selected.has('pass')).toBe(false)
  })

  it('toggles All checkbox to select all', async () => {
    const user = userEvent.setup()
    let selected = new Set<PipelineStatus>([])
    const onChange = (next: Set<PipelineStatus>) => { selected = next }
    await act(async () => {
      render(<PipelineFilter selected={selected} onChange={onChange} />)
    })
    const allCheckbox = screen.getByLabelText('All')
    await user.click(allCheckbox)
    expect(selected.size).toBe(5)
  })

  it('toggles All checkbox to deselect all', async () => {
    const user = userEvent.setup()
    let selected = new Set<PipelineStatus>(['pass', 'fail', 'running', 'pending', 'cancelled'])
    const onChange = (next: Set<PipelineStatus>) => { selected = next }
    await act(async () => {
      render(<PipelineFilter selected={selected} onChange={onChange} />)
    })
    const allCheckbox = screen.getByLabelText('All')
    await user.click(allCheckbox)
    expect(selected.size).toBe(0)
  })
})
