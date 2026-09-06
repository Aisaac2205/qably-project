import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ExecutionModeBadge } from '@/components/ui/execution-mode-badge'

describe('ExecutionModeBadge', () => {
  it('renders an icon and text for the manual mode', async () => {
    await act(async () => {
      render(<ExecutionModeBadge mode="manual" />)
    })
    expect(screen.getByText('Manual')).toBeInTheDocument()
    const badge = screen.getByText('Manual').closest('span')
    expect(badge?.querySelector('svg')).not.toBeNull()
    expect(badge?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders an icon and text for the automated mode', async () => {
    await act(async () => {
      render(<ExecutionModeBadge mode="automated" />)
    })
    expect(screen.getByText('Automated')).toBeInTheDocument()
    const badge = screen.getByText('Automated').closest('span')
    expect(badge?.querySelector('svg')).not.toBeNull()
  })

  it('never conveys the mode by color alone: text is always present', async () => {
    await act(async () => {
      render(<ExecutionModeBadge mode="automated" />)
    })
    expect(screen.getByText('Automated').textContent).not.toBe('')
  })
})
