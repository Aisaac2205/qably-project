import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CaseList } from '@/features/runs/components/case-list'
import type { RunCase } from '@qably/types'

const mockCases: RunCase[] = [
  {
    id: 'tc-1', name: 'Login redirects', suite: 'Auth',
    steps: [], expectedResult: '', status: 'pass',
  },
  {
    id: 'tc-2', name: 'Invalid credentials', suite: 'Auth',
    steps: [], expectedResult: '', status: 'fail',
  },
  {
    id: 'tc-3', name: 'Reset password', suite: 'Auth',
    steps: [], expectedResult: '', status: 'pending',
  },
]

describe('CaseList', () => {
  it('renders all cases', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      render(<CaseList cases={mockCases} onSelect={onSelect} />)
    })
    expect(screen.getByText('Login redirects')).toBeInTheDocument()
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    expect(screen.getByText('Reset password')).toBeInTheDocument()
  })

  it('renders status chips', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      render(<CaseList cases={mockCases} onSelect={onSelect} />)
    })
    expect(screen.getByText('Pass')).toBeInTheDocument()
    expect(screen.getByText('Fail')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('highlights selected case with border and bg', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      render(<CaseList cases={mockCases} selectedId="tc-2" onSelect={onSelect} />)
    })
    const selectedBtn = screen.getByRole('option', { name: /Invalid credentials/i })
    expect(selectedBtn).toHaveAttribute('aria-selected', 'true')
    expect(selectedBtn.className).toContain('border-l-2')
    expect(selectedBtn.className).toContain('border-primary')
  })

  it('calls onSelect on click', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(<CaseList cases={mockCases} onSelect={onSelect} />)
    })
    await user.click(screen.getByRole('option', { name: /Reset password/i }))
    expect(onSelect).toHaveBeenCalledWith('tc-3')
  })

  it('shows empty state when no cases', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      render(<CaseList cases={[]} onSelect={onSelect} />)
    })
    expect(screen.getByText('No cases in this run')).toBeInTheDocument()
  })
})
