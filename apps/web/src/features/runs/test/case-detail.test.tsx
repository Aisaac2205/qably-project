import { screen, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CaseDetail } from '@/features/runs/components/case-detail'
import { renderWithQuery } from '@/lib/query-test-utils'
import type { RunCaseRecord } from '@qably/types'
import {
  CI_FILE_PATH,
  CI_HUMANIZED_TITLE,
  CI_RAW_NAME,
  automatedOfficialCase,
  manualOfficialCase,
  reportedRunCase,
} from './run-case-fixtures'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

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
      renderWithQuery(<CaseDetail c={automatedCase} source="github_actions" />)
    })
    expect(screen.getByText('Redirects to dashboard on valid login')).toBeInTheDocument()
    const raw = screen.getByText('useCreateRun > redirects to dashboard on valid login')
    expect(raw.className).toContain('font-mono')
  })

  it('shows the file path', async () => {
    await act(async () => {
      renderWithQuery(<CaseDetail c={automatedCase} source="github_actions" />)
    })
    expect(screen.getByText('src/features/runs/hooks/use-create-run.test.ts')).toBeInTheDocument()
  })

  it('shows the formatted duration', async () => {
    await act(async () => {
      renderWithQuery(<CaseDetail c={automatedCase} source="github_actions" />)
    })
    expect(screen.getByText(/1[.,]23\s*s|1234\s*ms/)).toBeInTheDocument()
  })

  it('shows failure details in a native details/summary with the failure type and message as the summary', async () => {
    await act(async () => {
      renderWithQuery(<CaseDetail c={automatedCase} source="github_actions" />)
    })
    const summary = screen.getByText(/AssertionError.*expected true to be false/)
    expect(summary.closest('summary')).not.toBeNull()
    const details = summary.closest('details')
    expect(details).not.toBeNull()
    expect(within(details as HTMLElement).getByText(/at line 42/)).toBeInTheDocument()
  })

  it('shows the skip reason when the case was skipped', async () => {
    await act(async () => {
      renderWithQuery(
        <CaseDetail
          c={{ ...automatedCase, status: 'skip', failureType: undefined, failureMessage: undefined, failureDetails: undefined, skipReason: 'Flaky in CI' }}
          source="github_actions"
        />,
      )
    })
    expect(screen.getByText('Flaky in CI')).toBeInTheDocument()
  })

  it('does not show technical automated fields for a manual case', async () => {
    await act(async () => {
      renderWithQuery(<CaseDetail c={mockCase} source="manual" />)
    })
    expect(screen.queryByText(/AssertionError/)).not.toBeInTheDocument()
  })
})

describe('CaseDetail with an official case in an automated run', () => {
  const documented = automatedOfficialCase({
    version: 2,
    steps: ['Abrir el formulario de acceso', 'Enviar credenciales válidas'],
    expectedResult: 'Se redirige al panel',
  })

  it.each(['github_actions', 'api'] as const)(
    'shows the approved title, steps and expected result from the library (%s)',
    async (source) => {
      await act(async () => {
        renderWithQuery(
          <CaseDetail c={reportedRunCase({ officialCase: documented })} source={source} projectId="proj-1" />,
        )
      })
      expect(
        screen.getByRole('heading', { name: 'Redirige al panel con credenciales válidas' }),
      ).toBeInTheDocument()
      expect(screen.getByText('Abrir el formulario de acceso')).toBeInTheDocument()
      expect(screen.getByText('Enviar credenciales válidas')).toBeInTheDocument()
      expect(screen.getByText('Se redirige al panel')).toBeInTheDocument()
      expect(screen.queryByText(CI_HUMANIZED_TITLE)).not.toBeInTheDocument()
    },
  )

  it('keeps the reporter raw name in mono as the tool evidence', async () => {
    await act(async () => {
      renderWithQuery(
        <CaseDetail c={reportedRunCase({ officialCase: documented })} source="github_actions" projectId="proj-1" />,
      )
    })
    expect(screen.getByText(CI_RAW_NAME).className).toContain('font-mono')
  })

  it('shows the version of the library case', async () => {
    await act(async () => {
      renderWithQuery(
        <CaseDetail c={reportedRunCase({ officialCase: documented })} source="github_actions" projectId="proj-1" />,
      )
    })
    expect(screen.getByText('Version 2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /library/i })).toHaveAttribute(
      'href',
      '/projects/proj-1/suites/suite-1',
    )
  })

  it('hides the version badge but keeps the library link while the library case has no published version', async () => {
    await act(async () => {
      renderWithQuery(
        <CaseDetail
          c={reportedRunCase({ officialCase: automatedOfficialCase({ version: null }) })}
          source="github_actions"
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

  it('does not offer to document a case that already has approved documentation', async () => {
    await act(async () => {
      renderWithQuery(
        <CaseDetail c={reportedRunCase({ officialCase: documented })} source="github_actions" projectId="proj-1" />,
      )
    })
    expect(screen.queryByRole('button', { name: /document with aeris/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/no documented steps yet/i)).not.toBeInTheDocument()
  })

  it('offers to document a case whose library entry has neither steps nor expected result', async () => {
    const user = userEvent.setup()
    const api = await import('@/test/suites-api-stub')
    const documentSpy = vi.spyOn(api, 'documentCase')
    await act(async () => {
      renderWithQuery(
        <CaseDetail
          c={reportedRunCase({ officialCase: automatedOfficialCase() })}
          source="github_actions"
          projectId="proj-1"
        />,
      )
    })
    expect(screen.getByText(/no documented steps yet/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /document with aeris/i }))
    expect(documentSpy).toHaveBeenCalledWith('suite-1', 'case-9')
  })

  it('keeps the status, duration and file path from the run case', async () => {
    await act(async () => {
      renderWithQuery(
        <CaseDetail
          c={reportedRunCase({ status: 'fail', durationMs: 1234, officialCase: documented })}
          source="github_actions"
          projectId="proj-1"
        />,
      )
    })
    expect(screen.getByText('Fail')).toBeInTheDocument()
    expect(screen.getByText(/1[.,]23\s*s|1234\s*ms/)).toBeInTheDocument()
    expect(screen.getByText(CI_FILE_PATH)).toBeInTheDocument()
  })
})

describe('CaseDetail without an official case in an automated run', () => {
  it('explains the case is undocumented without offering Aeris', async () => {
    await act(async () => {
      renderWithQuery(
        <CaseDetail c={reportedRunCase({ testCaseId: null })} source="github_actions" projectId="proj-1" />,
      )
    })
    expect(screen.getByText(/no documented steps yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /document with aeris/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/^Version /)).not.toBeInTheDocument()
  })
})

describe('CaseDetail in a manual run', () => {
  it('never offers Aeris, even when the linked library case is undocumented and automated', async () => {
    await act(async () => {
      renderWithQuery(
        <CaseDetail
          c={{ ...mockCase, steps: [], expectedResult: '', officialCase: automatedOfficialCase() }}
          source="manual"
          projectId="proj-1"
        />,
      )
    })
    expect(screen.queryByRole('button', { name: /document with aeris/i })).not.toBeInTheDocument()
  })

  it('shows the run snapshot and no version badge but keeps the library link', async () => {
    await act(async () => {
      renderWithQuery(
        <CaseDetail
          c={{ ...mockCase, officialCase: manualOfficialCase({ name: 'Otro título', steps: ['Paso nuevo'] }) }}
          source="manual"
          projectId="proj-1"
        />,
      )
    })
    expect(screen.getByRole('heading', { name: 'Valid login redirects to dashboard' })).toBeInTheDocument()
    expect(screen.getByText('Navigate to /login')).toBeInTheDocument()
    expect(screen.queryByText('Paso nuevo')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Version /)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /library/i })).toHaveAttribute(
      'href',
      '/projects/proj-1/suites/suite-1',
    )
  })
})

describe('CaseDetail', () => {
  it('does not render a steps section when the case has no steps', async () => {
    await act(async () => {
      renderWithQuery(<CaseDetail c={{ ...mockCase, steps: [], expectedResult: '' }} source="manual" />)
    })
    expect(screen.queryByText('Steps')).not.toBeInTheDocument()
    expect(screen.queryByText('Expected result')).not.toBeInTheDocument()
    expect(screen.getByText(/no documented steps yet/i)).toBeInTheDocument()
  })

  it('does not render an expected result section when it is empty', async () => {
    await act(async () => {
      renderWithQuery(<CaseDetail c={{ ...mockCase, expectedResult: '' }} source="manual" />)
    })
    expect(screen.getByText('Steps')).toBeInTheDocument()
    expect(screen.queryByText('Expected result')).not.toBeInTheDocument()
  })

  it('never renders a hardcoded environment', async () => {
    await act(async () => {
      renderWithQuery(<CaseDetail c={mockCase} source="manual" projectId="proj-1" />)
    })
    expect(screen.queryByText(/staging/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/environment/i)).not.toBeInTheDocument()
  })

  it('hides the version badge and library link when the case is unlinked', async () => {
    await act(async () => {
      renderWithQuery(
        <CaseDetail
          c={{ ...mockCase, testCaseId: null, officialCase: null }}
          source="manual"
          projectId="proj-1"
        />,
      )
    })
    expect(screen.queryByText(/^Version /)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /library/i })).not.toBeInTheDocument()
  })

  it('renders case name', async () => {
    await act(async () => {
      renderWithQuery(<CaseDetail c={mockCase} source="manual" />)
    })
    expect(screen.getByText('Valid login redirects to dashboard')).toBeInTheDocument()
  })

  it('renders status chip', async () => {
    await act(async () => {
      renderWithQuery(<CaseDetail c={mockCase} source="manual" />)
    })
    expect(screen.getByText('Pass')).toBeInTheDocument()
  })

  it('renders steps', async () => {
    await act(async () => {
      renderWithQuery(<CaseDetail c={mockCase} source="manual" />)
    })
    expect(screen.getByText('Navigate to /login')).toBeInTheDocument()
    expect(screen.getByText('Enter valid email')).toBeInTheDocument()
    expect(screen.getByText('Click Sign in')).toBeInTheDocument()
  })

  it('renders expected result', async () => {
    await act(async () => {
      renderWithQuery(<CaseDetail c={mockCase} source="manual" />)
    })
    expect(screen.getByText('Redirected to /dashboard')).toBeInTheDocument()
  })

  it('shows section headings', async () => {
    await act(async () => {
      renderWithQuery(<CaseDetail c={mockCase} source="manual" />)
    })
    expect(screen.getByText('Steps')).toBeInTheDocument()
    expect(screen.getByText('Expected result')).toBeInTheDocument()
  })
})
