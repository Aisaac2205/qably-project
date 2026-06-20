import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { CaseCard } from '@/features/suites/components/case-card'
import type { TestCase } from '@qably/types'

const mockCase: TestCase = {
  id: 'tc-1',
  suiteId: 'suite-1',
  name: 'Valid login redirects to dashboard',
  steps: ['Navigate to /login', 'Enter valid email', 'Click Sign in'],
  expectedResult: 'Redirected to /dashboard within 1 second',
  priority: 'critical',
  state: 'active',
}

describe('CaseCard', () => {
  it('renders case name', async () => {
    await act(async () => { render(<CaseCard testCase={mockCase} />) })
    expect(screen.getByText('Valid login redirects to dashboard')).toBeInTheDocument()
  })

  it('shows priority badge', async () => {
    await act(async () => { render(<CaseCard testCase={mockCase} />) })
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('shows state badge', async () => {
    await act(async () => { render(<CaseCard testCase={mockCase} />) })
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('shows steps count and can toggle expand', async () => {
    const user = userEvent.setup()
    await act(async () => { render(<CaseCard testCase={mockCase} />) })
    expect(screen.getByText(/Steps \(3\)/)).toBeInTheDocument()
    await user.click(screen.getByText(/Steps \(3\)/))
    expect(screen.getByText('Navigate to /login')).toBeInTheDocument()
  })

  it('can toggle expected result', async () => {
    const user = userEvent.setup()
    await act(async () => { render(<CaseCard testCase={mockCase} />) })
    const expectedBtn = screen.getByText('Expected result')
    await user.click(expectedBtn)
    expect(screen.getByText(/Redirected to/)).toBeInTheDocument()
  })

  it('has accessible expand/collapse buttons', async () => {
    await act(async () => { render(<CaseCard testCase={mockCase} />) })
    const stepsBtn = screen.getByText(/Steps \(3\)/)
    expect(stepsBtn).toHaveAttribute('aria-expanded', 'false')
  })
})
