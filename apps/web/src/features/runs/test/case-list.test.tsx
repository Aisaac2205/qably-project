import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CaseList } from '@/features/runs/components/case-list'
import type { RunCaseRecord } from '@qably/types'
import {
  CI_HUMANIZED_TITLE,
  CI_RAW_NAME,
  automatedOfficialCase,
  manualOfficialCase,
  reportedRunCase,
  snapshotRunCase,
} from './run-case-fixtures'

const mockCases: RunCaseRecord[] = [
  {
    id: 'tc-1', testCaseId: null, officialCase: null, name: 'Login redirects', suiteName: 'Auth',
    steps: [], expectedResult: '', status: 'pass', position: 0,
  },
  {
    id: 'tc-2', testCaseId: null, officialCase: null, name: 'Invalid credentials', suiteName: 'Auth',
    steps: [], expectedResult: '', status: 'fail', position: 1,
  },
  {
    id: 'tc-3', testCaseId: null, officialCase: null, name: 'Reset password', suiteName: 'Auth',
    steps: [], expectedResult: '', status: 'pending', position: 2,
  },
]

const automatedCase: RunCaseRecord = {
  id: 'tc-9',
  testCaseId: null,
  officialCase: null,
  name: 'useCreateRun > redirects to dashboard on valid login',
  suiteName: 'Auth',
  steps: [],
  expectedResult: '',
  status: 'pass',
  position: 3,
  className: 'src/features/runs/hooks/use-create-run.test.ts',
  filePath: 'src/features/runs/hooks/use-create-run.test.ts',
}

describe('CaseList', () => {
  it('renders the humanized title for an automated case', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      render(<CaseList cases={[automatedCase]} source="github_actions" onSelect={onSelect} />)
    })
    expect(screen.getByText('Redirects to dashboard on valid login')).toBeInTheDocument()
  })

  it('renders the raw name in mono under the humanized title', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      render(<CaseList cases={[automatedCase]} source="github_actions" onSelect={onSelect} />)
    })
    const raw = screen.getByText('useCreateRun > redirects to dashboard on valid login')
    expect(raw.className).toContain('font-mono')
  })

  it('renders all cases', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      render(<CaseList cases={mockCases} source="manual" onSelect={onSelect} />)
    })
    expect(screen.getByText('Login redirects')).toBeInTheDocument()
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument()
    expect(screen.getByText('Reset password')).toBeInTheDocument()
  })

  it('renders status chips', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      render(<CaseList cases={mockCases} source="manual" onSelect={onSelect} />)
    })
    expect(screen.getByText('Pass')).toBeInTheDocument()
    expect(screen.getByText('Fail')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('highlights selected case with bg', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      render(<CaseList cases={mockCases} source="manual" selectedId="tc-2" onSelect={onSelect} />)
    })
    const selectedBtn = screen.getByRole('option', { name: /Invalid credentials/i })
    expect(selectedBtn).toHaveAttribute('aria-selected', 'true')
    expect(selectedBtn.className).toContain('bg-surface-hover')
  })

  it('calls onSelect on click', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(<CaseList cases={mockCases} source="manual" onSelect={onSelect} />)
    })
    await user.click(screen.getByRole('option', { name: /Reset password/i }))
    expect(onSelect).toHaveBeenCalledWith('tc-3')
  })

  it('shows empty state when no cases', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      render(<CaseList cases={[]} source="manual" onSelect={onSelect} />)
    })
    expect(screen.getByText('No cases in this run')).toBeInTheDocument()
  })

  it('titles an automated case with the library name and keeps the reporter name in mono underneath', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      render(
        <CaseList
          cases={[reportedRunCase({ officialCase: automatedOfficialCase() })]}
          source="github_actions"
          onSelect={onSelect}
        />,
      )
    })
    expect(screen.getByText('Redirige al panel con credenciales válidas')).toBeInTheDocument()
    expect(screen.queryByText(CI_HUMANIZED_TITLE)).not.toBeInTheDocument()
    expect(screen.getByText(CI_RAW_NAME).className).toContain('font-mono')
  })

  it('titles an api run case with the library name as well', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      render(
        <CaseList
          cases={[reportedRunCase({ officialCase: automatedOfficialCase() })]}
          source="api"
          onSelect={onSelect}
        />,
      )
    })
    expect(screen.getByText('Redirige al panel con credenciales válidas')).toBeInTheDocument()
  })

  it('keeps the snapshot title in a manual run even when the library case was renamed', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      render(
        <CaseList
          cases={[snapshotRunCase({ officialCase: manualOfficialCase({ name: 'Otro título' }) })]}
          source="manual"
          onSelect={onSelect}
        />,
      )
    })
    expect(screen.getByText('Valid login redirects to dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Otro título')).not.toBeInTheDocument()
  })

  it('does not repeat the reporter name when it only differs from the library title by case', async () => {
    const onSelect = vi.fn()
    await act(async () => {
      render(
        <CaseList
          cases={[
            reportedRunCase({
              name: 'redirects to dashboard',
              officialCase: automatedOfficialCase({ name: 'Redirects to dashboard' }),
            }),
          ]}
          source="github_actions"
          onSelect={onSelect}
        />,
      )
    })
    expect(screen.getAllByText(/redirects to dashboard/i)).toHaveLength(1)
  })
})
