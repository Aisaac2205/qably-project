import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CoverageGapsPanel } from '@/features/ai-review/components/coverage-gaps-panel'
import { __resetStore } from '@/lib/mock-store'

describe('CoverageGapsPanel', () => {
  beforeEach(() => __resetStore())

  it('is collapsed by default and expands on click', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<CoverageGapsPanel projectId="proj-1" onDraftWithAi={vi.fn()} />)
    })
    expect(screen.queryByText('Payment refunds')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /coverage gaps/i }))
    expect(screen.getByText('Payment refunds')).toBeInTheDocument()
  })

  it('calls onDraftWithAi with the gap area when the CTA is clicked', async () => {
    const onDraftWithAi = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(<CoverageGapsPanel projectId="proj-1" onDraftWithAi={onDraftWithAi} />)
    })
    await user.click(screen.getByRole('button', { name: /coverage gaps/i }))
    await user.click(screen.getAllByRole('button', { name: 'Draft with AI' })[0])
    expect(onDraftWithAi).toHaveBeenCalledWith('Payment refunds')
  })

  it('renders nothing when there are no gaps for the project', async () => {
    await act(async () => {
      render(<CoverageGapsPanel projectId="proj-with-no-gaps" onDraftWithAi={vi.fn()} />)
    })
    expect(screen.queryByRole('button', { name: /coverage gaps/i })).not.toBeInTheDocument()
  })
})
