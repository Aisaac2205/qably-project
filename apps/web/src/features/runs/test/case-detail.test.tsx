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
  it('does not render a steps section when the case has no steps', async () => {
    await act(async () => {
      render(<CaseDetail c={{ ...mockCase, steps: [], expectedResult: '' }} />)
    })
    expect(screen.queryByText('Steps')).not.toBeInTheDocument()
    expect(screen.queryByText('Expected result')).not.toBeInTheDocument()
    expect(screen.getByText(/no documented steps yet/i)).toBeInTheDocument()
  })

  it('does not render an expected result section when it is empty', async () => {
    await act(async () => {
      render(<CaseDetail c={{ ...mockCase, expectedResult: '' }} />)
    })
    expect(screen.getByText('Steps')).toBeInTheDocument()
    expect(screen.queryByText('Expected result')).not.toBeInTheDocument()
  })

  it('never renders a hardcoded environment', async () => {
    await act(async () => {
      render(<CaseDetail c={mockCase} projectId="proj-1" />)
    })
    expect(screen.queryByText(/staging/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/environment/i)).not.toBeInTheDocument()
  })

  it('shows the real version of the linked official case', async () => {
    await act(async () => {
      render(
        <CaseDetail
          c={{
            ...mockCase,
            testCaseId: 'case-9',
            officialCase: {
              id: 'case-9',
              suiteId: 'suite-1',
              version: 4,
              steps: [],
              expectedResult: '',
            },
          }}
          projectId="proj-1"
        />,
      )
    })
    expect(screen.getByText('Version 4')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /library/i })).toHaveAttribute(
      'href',
      '/projects/proj-1/suites/suite-1',
    )
  })

  it('hides the version badge but keeps the library link for an unpublished linked case', async () => {
    await act(async () => {
      render(
        <CaseDetail
          c={{
            ...mockCase,
            testCaseId: 'case-9',
            officialCase: {
              id: 'case-9',
              suiteId: 'suite-1',
              version: null,
              steps: [],
              expectedResult: '',
            },
          }}
          projectId="proj-1"
        />,
      )
    })
    expect(screen.queryByText(/^Version /)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /library/i })).toHaveAttribute(
      'href',
      '/projects/proj-1/suites/suite-1',
    )
  })

  it('hides the version badge and library link when the case is unlinked', async () => {
    await act(async () => {
      render(
        <CaseDetail
          c={{ ...mockCase, testCaseId: null, officialCase: null }}
          projectId="proj-1"
        />,
      )
    })
    expect(screen.queryByText(/^Version /)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /library/i })).not.toBeInTheDocument()
  })

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
