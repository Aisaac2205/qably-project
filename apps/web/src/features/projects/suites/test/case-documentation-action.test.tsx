import { screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import type { TestCase } from '@qably/types'
import { CaseDocumentationAction } from '@/features/projects/suites/components/case-documentation-action'
import { renderWithQuery } from '@/lib/query-test-utils'
import * as suitesApi from '@/test/suites-api-stub'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

const noop = () => {}

const automatedCase: TestCase = {
  id: 'tc-9',
  suiteId: 'suite-1',
  version: null,
  name: 'Redirects to dashboard on valid login',
  objective: '',
  preconditions: [],
  steps: [],
  expectedResult: '',
  priority: 'medium',
  state: 'draft',
  executionMode: 'automated',
  automationKey: 'useCreateRun > redirects to dashboard on valid login',
  automationFilePath: 'src/features/runs/hooks/use-create-run.test.ts',
}

function renderAction(overrides: Partial<TestCase> = {}) {
  return renderWithQuery(
    <CaseDocumentationAction
      testCase={{ ...automatedCase, ...overrides }}
      stepsOpen={false}
      onToggleSteps={noop}
      documentationBadge={null}
      onEdit={noop}
    />,
  )
}

describe('CaseDocumentationAction', () => {
  it('keeps Documentar visible and enabled after a failed Aeris attempt, with a plain-language reason', async () => {
    await act(async () => {
      renderAction({
        documentation: {
          outcome: 'failed',
          missing: [],
          skipReason: 'quota-exhausted',
          queuedAt: null,
          outcomeAt: '2026-03-01T00:00:00Z',
        },
      })
    })

    const action = screen.getByRole('button', { name: /document again with aeris/i })
    expect(action).toBeEnabled()
    expect(screen.queryByText('quota-exhausted')).not.toBeInTheDocument()
    expect(screen.getByText(/daily aeris documentation limit|límite diario/i)).toBeInTheDocument()
  })

  it('shows plain-language copy for a source-unavailable reason, never the raw code', async () => {
    await act(async () => {
      renderAction({
        documentation: {
          outcome: 'failed',
          missing: [],
          skipReason: 'http-404',
          queuedAt: null,
          outcomeAt: '2026-03-01T00:00:00Z',
        },
      })
    })

    expect(screen.queryByText('http-404')).not.toBeInTheDocument()
    expect(screen.getByText(/file could not be found|no se pudo encontrar/i)).toBeInTheDocument()
  })

  it('triggers a new Aeris attempt when the inline action is clicked after a failure', async () => {
    const user = userEvent.setup()
    const documentCase = vi.spyOn(suitesApi, 'documentCase')

    await act(async () => {
      renderAction({
        documentation: {
          outcome: 'failed',
          missing: [],
          skipReason: 'rate-limited',
          queuedAt: null,
          outcomeAt: '2026-03-01T00:00:00Z',
        },
      })
    })

    await user.click(screen.getByRole('button', { name: /document again with aeris/i }))

    expect(documentCase).toHaveBeenCalledWith('suite-1', 'tc-9')
  })

  it('shows a generic reason, never the raw code, for an unrecognized skip reason', async () => {
    await act(async () => {
      renderAction({
        documentation: {
          outcome: 'failed',
          missing: [],
          skipReason: 'a-reason-nobody-mapped-yet',
          queuedAt: null,
          outcomeAt: '2026-03-01T00:00:00Z',
        },
      })
    })

    expect(
      screen.getByRole('button', { name: /document again with aeris/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/a-reason-nobody-mapped-yet/)).not.toBeInTheDocument()
    expect(
      screen.getByText(/extraction failed for a reason|falló por un motivo/i),
    ).toBeInTheDocument()
  })

  it('still shows the in-review link when a proposal is pending and nothing has failed', async () => {
    await act(async () => {
      renderAction({ pendingProposalId: 'proposal-1' })
    })

    expect(screen.getByRole('link', { name: /in review/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /document again with aeris/i }),
    ).not.toBeInTheDocument()
  })

  it('shows the manual Documentar CTA for a non-automated case', async () => {
    await act(async () => {
      renderAction({ executionMode: 'manual' })
    })

    expect(screen.getByRole('button', { name: /document this case/i })).toBeInTheDocument()
  })
})
