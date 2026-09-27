import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CaseDisclosureToggle, CaseDisclosurePanel } from '@/features/projects/suites/components/case-disclosure'

describe('CaseDisclosureToggle', () => {
  it('reflects the closed state via aria-expanded and data-state', async () => {
    await act(async () => {
      render(<CaseDisclosureToggle label="3 steps" isOpen={false} onToggle={vi.fn()} />)
    })
    const toggle = screen.getByRole('button', { name: '3 steps' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle).toHaveAttribute('data-state', 'closed')
  })

  it('reflects the open state via aria-expanded and data-state', async () => {
    await act(async () => {
      render(<CaseDisclosureToggle label="3 steps" isOpen={true} onToggle={vi.fn()} />)
    })
    const toggle = screen.getByRole('button', { name: '3 steps' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle).toHaveAttribute('data-state', 'open')
  })

  it('rotates the caret only when open', async () => {
    const { rerender } = render(
      <CaseDisclosureToggle label="3 steps" isOpen={false} onToggle={vi.fn()} />,
    )
    const closedCaret = screen.getByRole('button', { name: '3 steps' }).querySelector('svg')
    expect(closedCaret?.getAttribute('class')).not.toContain('rotate-90')

    await act(async () => {
      rerender(<CaseDisclosureToggle label="3 steps" isOpen={true} onToggle={vi.fn()} />)
    })
    const openCaret = screen.getByRole('button', { name: '3 steps' }).querySelector('svg')
    expect(openCaret?.getAttribute('class')).toContain('rotate-90')
  })
})

describe('CaseDisclosurePanel', () => {
  it('renders nothing when closed', async () => {
    await act(async () => {
      render(
        <CaseDisclosurePanel isOpen={false}>
          <p>Panel content</p>
        </CaseDisclosurePanel>,
      )
    })
    expect(screen.queryByText('Panel content')).not.toBeInTheDocument()
  })

  it('renders children wrapped in a data-state="open" element when open', async () => {
    await act(async () => {
      render(
        <CaseDisclosurePanel isOpen={true}>
          <p>Panel content</p>
        </CaseDisclosurePanel>,
      )
    })
    const content = screen.getByText('Panel content')
    expect(content).toBeInTheDocument()
    expect(content.closest('[data-state="open"]')).not.toBeNull()
  })
})
