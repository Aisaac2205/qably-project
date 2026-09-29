import { screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import type { TestCase } from '@qably/types'
import { CaseDocumentationAction } from '@/features/projects/suites/components/case-documentation-action'
import type { CaseDocumentationBadge } from '@/features/projects/suites/lib/case-documentation-state'
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

const documentedAutomatedCase: TestCase = {
  ...automatedCase,
  steps: ['Open the login page', 'Submit valid credentials'],
  expectedResult: 'The dashboard opens',
  state: 'active',
  healthSignals: [],
}

function renderAction(
  overrides: Partial<TestCase> = {},
  documentationBadge: CaseDocumentationBadge | null = null,
) {
  return renderWithQuery(
    <CaseDocumentationAction
      testCase={{ ...automatedCase, ...overrides }}
      stepsOpen={false}
      onToggleSteps={noop}
      documentationBadge={documentationBadge}
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

  describe('in-review link', () => {
    it('links to the pending proposal for an automated case with zero steps', async () => {
      await act(async () => {
        renderAction({ pendingProposalId: 'proposal-1' })
      })

      expect(screen.getByRole('link', { name: /in review/i })).toHaveAttribute(
        'href',
        '/review-inbox?proposal=proposal-1',
      )
    })

    it('shows the link next to the steps toggle when the case already has steps', async () => {
      await act(async () => {
        renderAction({ ...documentedAutomatedCase, pendingProposalId: 'proposal-2' })
      })

      expect(screen.getByRole('button', { name: /2 steps/i })).toHaveAttribute(
        'aria-expanded',
        'false',
      )
      expect(screen.getByRole('link', { name: /in review/i })).toHaveAttribute(
        'href',
        '/review-inbox?proposal=proposal-2',
      )
    })

    it('keeps the steps toggle first and the link second in keyboard order', async () => {
      await act(async () => {
        renderAction({ ...documentedAutomatedCase, pendingProposalId: 'proposal-2' })
      })

      const toggle = screen.getByRole('button', { name: /2 steps/i })
      const link = screen.getByRole('link', { name: /in review/i })

      expect(toggle.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('keeps the toggle and the link in the same inline group, not in a second container', async () => {
      await act(async () => {
        renderAction({ ...documentedAutomatedCase, pendingProposalId: 'proposal-2' })
      })

      const toggle = screen.getByRole('button', { name: /2 steps/i })
      const link = screen.getByRole('link', { name: /in review/i })

      expect(link.parentElement).toBe(toggle.parentElement)
    })

    it('draws a visible ring on keyboard focus, since the global rule removes the outline', async () => {
      await act(async () => {
        renderAction({ pendingProposalId: 'proposal-1' })
      })

      const link = screen.getByRole('link', { name: /in review/i })

      expect(link.className).toContain('focus-visible:ring-2')
      expect(link.className).toContain('focus-visible:ring-primary')
    })

    it('shows only the steps toggle when a case with steps has no pending proposal', async () => {
      await act(async () => {
        renderAction({ ...documentedAutomatedCase, pendingProposalId: null })
      })

      expect(screen.getByRole('button', { name: /2 steps/i })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /in review/i })).not.toBeInTheDocument()
    })

    it('shows only the steps toggle when the pending id is absent from the payload', async () => {
      await act(async () => {
        renderAction(documentedAutomatedCase)
      })

      expect(screen.getByRole('button', { name: /2 steps/i })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /in review/i })).not.toBeInTheDocument()
    })

    it('lets an active Aeris documentation badge take precedence over the link, with steps', async () => {
      await act(async () => {
        renderAction(
          { ...documentedAutomatedCase, pendingProposalId: 'proposal-2' },
          { kind: 'documenting' },
        )
      })

      expect(screen.getByRole('button', { name: /2 steps/i })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /in review/i })).not.toBeInTheDocument()
    })

    it('lets an active Aeris documentation badge take precedence over the link, without steps', async () => {
      await act(async () => {
        renderAction({ pendingProposalId: 'proposal-1' }, { kind: 'documenting' })
      })

      expect(screen.queryByRole('link', { name: /in review/i })).not.toBeInTheDocument()
    })

    it('shows the link for a manual case with steps, next to its steps toggle', async () => {
      await act(async () => {
        renderAction({
          ...documentedAutomatedCase,
          executionMode: 'manual',
          automationKey: undefined,
          automationFilePath: undefined,
          pendingProposalId: 'proposal-3',
        })
      })

      expect(screen.getByRole('button', { name: /2 steps/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /in review/i })).toHaveAttribute(
        'href',
        '/review-inbox?proposal=proposal-3',
      )
    })

    it('shows the link instead of the manual Documentar CTA when a proposal is already pending', async () => {
      await act(async () => {
        renderAction({ executionMode: 'manual', pendingProposalId: 'proposal-3' })
      })

      expect(screen.getByRole('link', { name: /in review/i })).toHaveAttribute(
        'href',
        '/review-inbox?proposal=proposal-3',
      )
      expect(
        screen.queryByRole('button', { name: /document this case/i }),
      ).not.toBeInTheDocument()
    })

    it('keeps the manual Documentar CTA when no proposal is pending', async () => {
      await act(async () => {
        renderAction({ executionMode: 'manual', pendingProposalId: null })
      })

      expect(screen.getByRole('button', { name: /document this case/i })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /in review/i })).not.toBeInTheDocument()
    })
  })
})
