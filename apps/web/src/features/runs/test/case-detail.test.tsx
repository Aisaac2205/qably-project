import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CaseDetail } from '@/features/runs/components/case-detail'
import type { RunCaseRecord } from '@qably/types'

const mockCase: RunCaseRecord = {
  id: 'tc-1',
  testCaseId: 'tc-1',
  officialCase: null,
  name: 'Valid login redirects to dashboard',
  suiteName: 'Authentication',
  steps: ['Navigate to /login', 'Enter valid email', 'Click Sign in'],
  expectedResult: 'Redirected to /dashboard',
  status: 'pass',
  position: 0,
}

describe('CaseDetail', () => {
  it('renders case name', async () => {
    await act(async () => {
      render(<CaseDetail c={mockCase} />)
    })
    expect(screen.getByText('Valid login redirects to dashboard')).toBeInTheDocument()
  })

  it('renders status chip', async () => {
    await act(async () => {
      render(<CaseDetail c={mockCase} />)
    })
    expect(screen.getByText('Pass')).toBeInTheDocument()
  })

  it('renders steps', async () => {
    await act(async () => {
      render(<CaseDetail c={mockCase} />)
    })
    expect(screen.getByText('Navigate to /login')).toBeInTheDocument()
    expect(screen.getByText('Enter valid email')).toBeInTheDocument()
    expect(screen.getByText('Click Sign in')).toBeInTheDocument()
  })

  it('renders expected result', async () => {
    await act(async () => {
      render(<CaseDetail c={mockCase} />)
    })
    expect(screen.getByText('Redirected to /dashboard')).toBeInTheDocument()
  })

  it('shows section headings', async () => {
    await act(async () => {
      render(<CaseDetail c={mockCase} />)
    })
    expect(screen.getByText('Steps')).toBeInTheDocument()
    expect(screen.getByText('Expected result')).toBeInTheDocument()
  })
})
