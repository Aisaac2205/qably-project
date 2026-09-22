import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ChatCaseChip } from '@/features/ai-review/components/chat-case-chip'
import type { AttachedCaseRecord } from '@qably/types'

const attachedCase: AttachedCaseRecord = {
  id: 'tc-1',
  name: 'Valid login redirects to dashboard',
  suiteName: 'Authentication',
}

describe('ChatCaseChip', () => {
  it('shows the case name and its suite', async () => {
    await act(async () => {
      render(<ChatCaseChip attachedCase={attachedCase} />)
    })
    expect(screen.getByText('Valid login redirects to dashboard')).toBeInTheDocument()
    expect(screen.getByText('Authentication')).toBeInTheDocument()
  })

  it('shows no remove control when onRemove is not provided', async () => {
    await act(async () => {
      render(<ChatCaseChip attachedCase={attachedCase} />)
    })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('calls onRemove with the case id when the remove control is used', async () => {
    const onRemove = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(<ChatCaseChip attachedCase={attachedCase} onRemove={onRemove} />)
    })

    await user.click(screen.getByRole('button', { name: 'Remove Valid login redirects to dashboard' }))

    expect(onRemove).toHaveBeenCalledWith('tc-1')
  })

  it('gives the remove control at least a 24x24 CSS px hit area', async () => {
    await act(async () => {
      render(<ChatCaseChip attachedCase={attachedCase} onRemove={vi.fn()} />)
    })

    const removeButton = screen.getByRole('button', {
      name: 'Remove Valid login redirects to dashboard',
    })

    expect(removeButton).toHaveClass('size-6')
  })
})
