import { render, screen, act, within } from '@testing-library/react'
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

const automatedCase: RunCaseRecord = {
  id: 'tc-9',
  testCaseId: 'tc-9',
  officialCase: null,
  name: 'useCreateRun > redirects to dashboard on valid login',
  suiteName: 'Auth',
  steps: [],
  expectedResult: '',
  status: 'fail',
  position: 0,
  className: 'src/features/runs/hooks/use-create-run.test.ts',
  filePath: 'src/features/runs/hooks/use-create-run.test.ts',
  durationMs: 1234,
  failureType: 'AssertionError',
  failureMessage: 'expected true to be false',
  failureDetails: 'at line 42\nat line 43',
}

describe('CaseDetail (automated)', () => {
  it('renders the humanized title with the raw name in mono', async () => {
    await act(async () => {
      render(<CaseDetail c={automatedCase} />)
    })
    expect(screen.getByText('Redirects to dashboard on valid login')).toBeInTheDocument()
    const raw = screen.getByText('useCreateRun > redirects to dashboard on valid login')
    expect(raw.className).toContain('font-mono')
  })

  it('shows the file path', async () => {
    await act(async () => {
      render(<CaseDetail c={automatedCase} />)
    })
    expect(screen.getByText('src/features/runs/hooks/use-create-run.test.ts')).toBeInTheDocument()
  })

  it('shows the formatted duration', async () => {
    await act(async () => {
      render(<CaseDetail c={automatedCase} />)
    })
    expect(screen.getByText(/1[.,]23\s*s|1234\s*ms/)).toBeInTheDocument()
  })

  it('shows failure details in a native details/summary with the failure type and message as the summary', async () => {
    await act(async () => {
      render(<CaseDetail c={automatedCase} />)
    })
    const summary = screen.getByText(/AssertionError.*expected true to be false/)
    expect(summary.closest('summary')).not.toBeNull()
    const details = summary.closest('details')
    expect(details).not.toBeNull()
    expect(within(details as HTMLElement).getByText(/at line 42/)).toBeInTheDocument()
  })

  it('shows the skip reason when the case was skipped', async () => {
    await act(async () => {
      render(<CaseDetail c={{ ...automatedCase, status: 'skip', failureType: undefined, failureMessage: undefined, failureDetails: undefined, skipReason: 'Flaky in CI' }} />)
    })
    expect(screen.getByText('Flaky in CI')).toBeInTheDocument()
  })

  it('does not show technical automated fields for a manual case', async () => {
    await act(async () => {
      render(<CaseDetail c={mockCase} />)
    })
    expect(screen.queryByText(/AssertionError/)).not.toBeInTheDocument()
  })
})

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
