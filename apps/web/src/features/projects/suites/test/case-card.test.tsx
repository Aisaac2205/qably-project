import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CaseCard } from '@/features/projects/suites/components/case-card'
import type { TestCase } from '@qably/types'

const mockCase: TestCase = {
  id: 'tc-1',
  suiteId: 'suite-1',
  version: 2,
  name: 'Valid login redirects to dashboard',
  steps: ['Navigate to /login', 'Enter valid email', 'Click Sign in'],
  expectedResult: 'Redirected to /dashboard within 1 second',
  priority: 'critical',
  state: 'active',
}

const noop = () => {}

describe('CaseCard', () => {
  it('shows the published version of the case', async () => {
    await act(async () => { render(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.getByText('v2')).toBeInTheDocument()
  })

  it('offers to document a case that has no steps', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    await act(async () => {
      render(<CaseCard testCase={{ ...mockCase, steps: [] }} onEdit={onEdit} onDelete={noop} />)
    })
    expect(screen.queryByText('0 steps')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /document this case/i }))
    expect(onEdit).toHaveBeenCalled()
  })

  it('keeps the steps disclosure when the case has steps', async () => {
    await act(async () => { render(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.getByText('3 steps')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /document this case/i })).not.toBeInTheDocument()
  })

  it('renders case name', async () => {
    await act(async () => { render(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.getByText('Valid login redirects to dashboard')).toBeInTheDocument()
  })

  it('shows priority badge', async () => {
    await act(async () => { render(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('shows state badge', async () => {
    await act(async () => { render(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.getByText('Active')).toBeInTheDocument()
    const chip = screen.getByText('Active').closest('span')
    expect(chip).toHaveAttribute('data-status', 'active')
    expect(chip?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows steps count and can toggle expand', async () => {
    const user = userEvent.setup()
    await act(async () => { render(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.getByText(/3 steps/i)).toBeInTheDocument()
    await user.click(screen.getByText(/3 steps/i))
    expect(screen.getByText('Navigate to /login')).toBeInTheDocument()
  })

  it('can toggle expected result', async () => {
    const user = userEvent.setup()
    await act(async () => { render(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    const expectedBtn = screen.getByText('Expected result')
    await user.click(expectedBtn)
    expect(screen.getByText(/Redirected to/)).toBeInTheDocument()
  })

  it('has accessible expand/collapse buttons', async () => {
    await act(async () => { render(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    const stepsBtn = screen.getByText(/3 steps/i)
    expect(stepsBtn).toHaveAttribute('aria-expanded', 'false')
  })

  it('calls onEdit from the actions menu', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    await act(async () => { render(<CaseCard testCase={mockCase} onEdit={onEdit} onDelete={noop} />) })

    await user.click(screen.getByRole('button', { name: 'Case actions' }))
    await user.click(await screen.findByText('Edit case'))

    expect(onEdit).toHaveBeenCalledWith(mockCase)
  })

  it('calls onDelete from the actions menu', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    await act(async () => { render(<CaseCard testCase={mockCase} onEdit={noop} onDelete={onDelete} />) })

    await user.click(screen.getByRole('button', { name: 'Case actions' }))
    await user.click(await screen.findByText('Delete case'))

    expect(onDelete).toHaveBeenCalledWith(mockCase)
  })
})
