import { screen, act, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CaseCard } from '@/features/projects/suites/components/case-card'
import type { TestCase } from '@qably/types'
import { renderWithQuery } from '@/lib/query-test-utils'
import * as suitesApi from '@/test/suites-api-stub'
import { ApiError } from '@/lib/api-client'
import { notify } from '@/lib/notify'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)

vi.mock('@/lib/notify', () => ({
  notify: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}))

const mockCase: TestCase = {
  id: 'tc-1',
  suiteId: 'suite-1',
  version: 2,
  name: 'Valid login redirects to dashboard',
  objective: 'Confirm a valid login redirects to the dashboard',
  preconditions: ['The user has a registered account'],
  steps: ['Navigate to /login', 'Enter valid email', 'Click Sign in'],
  expectedResult: 'Redirected to /dashboard within 1 second',
  priority: 'critical',
  state: 'active',
  executionMode: 'manual',
}

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

const observedCase: TestCase = {
  ...mockCase,
  id: 'tc-obs',
  observations: [
    'The test asserts the redirect but never checks the session cookie.',
    'It depends on a fixture user that other suites also mutate.',
  ],
}

const noop = () => {}

describe('CaseCard observations', () => {
  it('keeps the Aeris observations behind a toggle so the card stays scannable', async () => {
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(<CaseCard testCase={observedCase} onEdit={noop} onDelete={noop} />)
    })

    expect(
      screen.queryByText(/never checks the session cookie/i),
    ).not.toBeInTheDocument()

    const toggle = screen.getByRole('button', { name: /2 Aeris observations/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/never checks the session cookie/i)).toBeInTheDocument()
    expect(screen.getByText(/other suites also mutate/i)).toBeInTheDocument()
  })

  it('counts a single observation in the singular', async () => {
    await act(async () => {
      renderWithQuery(
        <CaseCard
          testCase={{ ...observedCase, observations: ['Only one note.'] }}
          onEdit={noop}
          onDelete={noop}
        />,
      )
    })

    expect(
      screen.getByRole('button', { name: /1 Aeris observation$/i }),
    ).toBeInTheDocument()
  })

  it('shows no observations affordance when Aeris left none', async () => {
    await act(async () => {
      renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />)
    })

    expect(
      screen.queryByRole('button', { name: /Aeris observation/i }),
    ).not.toBeInTheDocument()
  })

  it('counts a single step in the singular', async () => {
    await act(async () => {
      renderWithQuery(
        <CaseCard
          testCase={{ ...mockCase, steps: ['Only one step'] }}
          onEdit={noop}
          onDelete={noop}
        />,
      )
    })

    expect(screen.getByRole('button', { name: /^1 step$/i })).toBeInTheDocument()
  })
})

describe('CaseCard', () => {
  it('shows the raw automation key in mono under the humanized title when it differs', async () => {
    await act(async () => { renderWithQuery(<CaseCard testCase={automatedCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.getByText('Redirects to dashboard on valid login')).toBeInTheDocument()
    const raw = screen.getByText('useCreateRun > redirects to dashboard on valid login')
    expect(raw.closest('p')?.className).toContain('font-mono')
  })

  it('does not show a redundant raw name line for a manual case', async () => {
    await act(async () => { renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.queryByText(mockCase.name, { selector: '.font-mono' })).not.toBeInTheDocument()
  })

  it('shows the file path for an automated case', async () => {
    await act(async () => { renderWithQuery(<CaseCard testCase={automatedCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.getByText('src/features/runs/hooks/use-create-run.test.ts')).toBeInTheDocument()
  })

  it('never shows a raw version chip, published or not', async () => {
    await act(async () => { renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.queryByText(/^v\d/)).not.toBeInTheDocument()
  })

  it('offers to document a case that has no steps', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    await act(async () => {
      renderWithQuery(<CaseCard testCase={{ ...mockCase, steps: [] }} onEdit={onEdit} onDelete={noop} />)
    })
    expect(screen.queryByText('0 steps')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /document this case/i }))
    expect(onEdit).toHaveBeenCalled()
  })

  it('keeps the steps disclosure when the case has steps', async () => {
    await act(async () => { renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.getByText('3 steps')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /document this case/i })).not.toBeInTheDocument()
  })

  it('renders case name', async () => {
    await act(async () => { renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.getByText('Valid login redirects to dashboard')).toBeInTheDocument()
  })

  it('shows priority badge', async () => {
    await act(async () => { renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })

  it('shows state badge', async () => {
    await act(async () => { renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.getByText('Active')).toBeInTheDocument()
    const chip = screen.getByText('Active').closest('span')
    expect(chip).toHaveAttribute('data-status', 'active')
    expect(chip?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows the objective as a line under the title when present', async () => {
    await act(async () => { renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    expect(
      screen.getByText('Confirm a valid login redirects to the dashboard'),
    ).toBeInTheDocument()
  })

  it('shows no objective line when the case has none', async () => {
    await act(async () => { renderWithQuery(<CaseCard testCase={automatedCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.queryByTestId('case-objective')).not.toBeInTheDocument()
  })

  it('shows preconditions count and can toggle expand', async () => {
    const user = userEvent.setup()
    await act(async () => { renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    const toggle = screen.getByRole('button', { name: /1 precondition$/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('The user has a registered account')).toBeInTheDocument()
  })

  it('shows no preconditions disclosure when the case has none', async () => {
    await act(async () => { renderWithQuery(<CaseCard testCase={automatedCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.queryByRole('button', { name: /precondition/i })).not.toBeInTheDocument()
  })

  it('orders the disclosure toggles as preconditions, steps, expected result', async () => {
    await act(async () => { renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    const buttons = screen.getAllByRole('button').filter((button) =>
      /precondition|step|expected result/i.test(button.textContent ?? ''),
    )
    expect(buttons.map((button) => button.textContent)).toEqual([
      '1 precondition',
      '3 steps',
      'Expected result',
    ])
  })

  it('shows steps count and can toggle expand', async () => {
    const user = userEvent.setup()
    await act(async () => { renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.getByText(/3 steps/i)).toBeInTheDocument()
    await user.click(screen.getByText(/3 steps/i))
    expect(screen.getByText('Navigate to /login')).toBeInTheDocument()
  })

  it('can toggle expected result', async () => {
    const user = userEvent.setup()
    await act(async () => { renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    const expectedBtn = screen.getByText('Expected result')
    await user.click(expectedBtn)
    expect(screen.getByText(/Redirected to/)).toBeInTheDocument()
  })

  it('has accessible expand/collapse buttons', async () => {
    await act(async () => { renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    const stepsBtn = screen.getByText(/3 steps/i)
    expect(stepsBtn).toHaveAttribute('aria-expanded', 'false')
  })

  it('calls onEdit from the actions menu', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    await act(async () => { renderWithQuery(<CaseCard testCase={mockCase} onEdit={onEdit} onDelete={noop} />) })

    await user.click(screen.getByRole('button', { name: 'Case actions' }))
    await user.click(await screen.findByText('Edit case'))

    expect(onEdit).toHaveBeenCalledWith(mockCase)
  })

  it('calls onDelete from the actions menu', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    await act(async () => { renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={onDelete} />) })

    await user.click(screen.getByRole('button', { name: 'Case actions' }))
    await user.click(await screen.findByText('Delete case'))

    expect(onDelete).toHaveBeenCalledWith(mockCase)
  })

  describe('re-document with Aeris', () => {
    it('offers to document again from the actions menu for an automated case', async () => {
      const user = userEvent.setup()
      const documentCase = vi.spyOn(suitesApi, 'documentCase')
      await act(async () => { renderWithQuery(<CaseCard testCase={automatedCase} onEdit={noop} onDelete={noop} />) })

      await user.click(screen.getByRole('button', { name: 'Case actions' }))
      await user.click(await screen.findByText('Document again with Aeris'))

      expect(documentCase).toHaveBeenCalledWith('suite-1', 'tc-9')
    })

    it('does not offer to document again for a manual case', async () => {
      const user = userEvent.setup()
      await act(async () => { renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })

      await user.click(screen.getByRole('button', { name: 'Case actions' }))

      expect(screen.queryByText('Document again with Aeris')).not.toBeInTheDocument()
    })

    it('shows the AI-not-enabled message when re-documenting is refused for the organization', async () => {
      const user = userEvent.setup()
      vi.spyOn(suitesApi, 'documentCase').mockRejectedValueOnce(
        new ApiError(403, 'AI features are not enabled for this organization', 'ai-not-enabled'),
      )
      await act(async () => { renderWithQuery(<CaseCard testCase={automatedCase} onEdit={noop} onDelete={noop} />) })

      await user.click(screen.getByRole('button', { name: 'Case actions' }))
      await user.click(await screen.findByText('Document again with Aeris'))

      await waitFor(() => {
        expect(notify.error).toHaveBeenCalledWith(
          'AI extraction is not enabled for this organization.',
        )
      })
    })
  })

  describe('quality health signals', () => {
    it('renders nothing extra for a case with no health signals', async () => {
      await act(async () => {
        renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />)
      })

      expect(screen.queryByRole('group', { name: /quality signals/i })).not.toBeInTheDocument()
    })

    it('renders a chip per quality signal the case carries, as a visible label rather than color alone', async () => {
      await act(async () => {
        renderWithQuery(
          <CaseCard
            testCase={{ ...automatedCase, healthSignals: ['raw-name', 'flaky'] }}
            onEdit={noop}
            onDelete={noop}
          />,
        )
      })

      const strip = screen.getByRole('group', { name: /quality signals/i })
      expect(within(strip).getByRole('button', { name: /raw name/i })).toBeInTheDocument()
      expect(within(strip).getByRole('button', { name: /flaky/i })).toBeInTheDocument()
    })

    it('collapses the workflow signals into the single most actionable state', async () => {
      await act(async () => {
        renderWithQuery(
          <CaseCard
            testCase={{ ...automatedCase, healthSignals: ['no-steps'] }}
            onEdit={noop}
            onDelete={noop}
          />,
        )
      })

      expect(screen.getByText(/^undocumented$/i)).toBeInTheDocument()
      expect(screen.queryByText(/^draft$/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/^no steps$/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/^never run$/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('group', { name: /quality signals/i })).not.toBeInTheDocument()
    })

    it('asks for confirmation on a documented draft instead of stacking draft and never-run', async () => {
      await act(async () => {
        renderWithQuery(
          <CaseCard
            testCase={{
              ...automatedCase,
              steps: ['Log in'],
              expectedResult: 'The dashboard opens',
              healthSignals: [],
            }}
            onEdit={noop}
            onDelete={noop}
          />,
        )
      })

      expect(screen.getByText(/^unconfirmed$/i)).toBeInTheDocument()
      expect(screen.queryByText(/^draft$/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/^never run$/i)).not.toBeInTheDocument()
    })
  })

  describe('pending review state', () => {
    it('shows a non-interactive in-review link instead of the AI button when a proposal is pending', async () => {
      await act(async () => {
        renderWithQuery(
          <CaseCard
            testCase={{ ...automatedCase, pendingProposalId: 'proposal-1' }}
            projectId="proj-1"
            onEdit={noop}
            onDelete={noop}
          />,
        )
      })

      expect(screen.queryByText(/^undocumented$/i)).not.toBeInTheDocument()
      const link = screen.getByRole('link', { name: /in review/i })
      expect(link).toHaveAttribute('href', '/review-inbox?proposal=proposal-1')
    })

    it('shows a state-only undocumented chip, never a button, when no proposal is pending', async () => {
      await act(async () => {
        renderWithQuery(
          <CaseCard
            testCase={{ ...automatedCase, pendingProposalId: null }}
            projectId="proj-1"
            onEdit={noop}
            onDelete={noop}
          />,
        )
      })

      expect(screen.getByText(/^undocumented$/i)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /document with aeris/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /in review/i })).not.toBeInTheDocument()
    })
  })

  describe('documented locale', () => {
    it('flags a case the server marked as locale-stale', async () => {
      await act(async () => {
        renderWithQuery(
          <CaseCard
            testCase={{ ...mockCase, documentedLocale: 'es', localeStale: true }}
            projectId="proj-1"
            onEdit={noop}
            onDelete={noop}
          />,
        )
      })

      expect(screen.getByText(/documented in spanish/i)).toBeInTheDocument()
    })

    it('stays quiet when the server did not mark the case as locale-stale', async () => {
      await act(async () => {
        renderWithQuery(
          <CaseCard
            testCase={{ ...mockCase, documentedLocale: 'es', localeStale: false }}
            projectId="proj-1"
            onEdit={noop}
            onDelete={noop}
          />,
        )
      })

      expect(screen.queryByText(/documented in/i)).not.toBeInTheDocument()
    })
  })

  describe('GitHub link', () => {
    it('links an automated case to its file on GitHub when a repo is known', async () => {
      await act(async () => {
        renderWithQuery(
          <CaseCard
            testCase={automatedCase}
            githubRepo="acme/ecommerce-app"
            onEdit={noop}
            onDelete={noop}
          />,
        )
      })

      const link = screen.getByRole('link', { name: /view file on github/i })
      expect(link).toHaveAttribute(
        'href',
        'https://github.com/acme/ecommerce-app/blob/HEAD/src/features/runs/hooks/use-create-run.test.ts',
      )
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('shows no GitHub link for a manual case even when a repo is known', async () => {
      await act(async () => {
        renderWithQuery(
          <CaseCard testCase={mockCase} githubRepo="acme/ecommerce-app" onEdit={noop} onDelete={noop} />,
        )
      })

      expect(screen.queryByRole('link', { name: /view file on github/i })).not.toBeInTheDocument()
    })

    it('shows no GitHub link when the case has no automation file path', async () => {
      await act(async () => {
        renderWithQuery(
          <CaseCard
            testCase={{ ...automatedCase, automationFilePath: undefined }}
            githubRepo="acme/ecommerce-app"
            onEdit={noop}
            onDelete={noop}
          />,
        )
      })

      expect(screen.queryByRole('link', { name: /view file on github/i })).not.toBeInTheDocument()
    })

    it('shows no GitHub link when the project has no known repo', async () => {
      await act(async () => {
        renderWithQuery(<CaseCard testCase={automatedCase} onEdit={noop} onDelete={noop} />)
      })

      expect(screen.queryByRole('link', { name: /view file on github/i })).not.toBeInTheDocument()
    })
  })

  describe('Aeris documentation state badge', () => {
    it('shows documenting while queued with no outcome yet, taking priority over the lifecycle state, with no competing "in review" link', async () => {
      await act(async () => {
        renderWithQuery(
          <CaseCard
            testCase={{
              ...automatedCase,
              pendingProposalId: 'proposal-1',
              documentation: {
                outcome: null,
                missing: [],
                skipReason: null,
                queuedAt: '2026-03-01T00:00:00Z',
                outcomeAt: null,
              },
            }}
            onEdit={noop}
            onDelete={noop}
          />,
        )
      })

      expect(screen.getByText('Documenting')).toBeInTheDocument()
      expect(screen.queryByText(/^undocumented$/i)).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /in review/i })).not.toBeInTheDocument()
    })

    it('shows exactly one state, and no "in review" link, when a case was skipped because it is already pending review', async () => {
      await act(async () => {
        renderWithQuery(
          <CaseCard
            testCase={{
              ...automatedCase,
              pendingProposalId: 'proposal-1',
              documentation: {
                outcome: 'skipped',
                missing: [],
                skipReason: 'already-pending',
                queuedAt: null,
                outcomeAt: '2026-03-01T00:00:00Z',
              },
            }}
            onEdit={noop}
            onDelete={noop}
          />,
        )
      })

      expect(
        screen.getByText(/already waiting in the review inbox/i),
      ).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /in review/i })).not.toBeInTheDocument()
    })

    it('shows the missing fields for an incomplete outcome', async () => {
      await act(async () => {
        renderWithQuery(
          <CaseCard
            testCase={{
              ...automatedCase,
              documentation: {
                outcome: 'incomplete',
                missing: ['objective', 'steps'],
                skipReason: null,
                queuedAt: null,
                outcomeAt: '2026-03-01T00:00:00Z',
              },
            }}
            onEdit={noop}
            onDelete={noop}
          />,
        )
      })

      expect(screen.getByText('Incomplete: missing Objective, Steps')).toBeInTheDocument()
    })

    it('shows the skip reason for a skipped outcome', async () => {
      await act(async () => {
        renderWithQuery(
          <CaseCard
            testCase={{
              ...automatedCase,
              documentation: {
                outcome: 'skipped',
                missing: [],
                skipReason: 'no-source-file',
                queuedAt: null,
                outcomeAt: '2026-03-01T00:00:00Z',
              },
            }}
            onEdit={noop}
            onDelete={noop}
          />,
        )
      })

      expect(
        screen.getByText("Skipped: Aeris hasn't identified the test file yet"),
      ).toBeInTheDocument()
    })

    it('shows an Aeris error for a failed outcome', async () => {
      await act(async () => {
        renderWithQuery(
          <CaseCard
            testCase={{
              ...automatedCase,
              documentation: {
                outcome: 'failed',
                missing: [],
                skipReason: null,
                queuedAt: null,
                outcomeAt: '2026-03-01T00:00:00Z',
              },
            }}
            onEdit={noop}
            onDelete={noop}
          />,
        )
      })

      expect(screen.getByText('Aeris error')).toBeInTheDocument()
    })

    it('leaves the lifecycle state untouched once the outcome is complete', async () => {
      await act(async () => {
        renderWithQuery(
          <CaseCard
            testCase={{
              ...mockCase,
              documentation: {
                outcome: 'complete',
                missing: [],
                skipReason: null,
                queuedAt: null,
                outcomeAt: '2026-03-01T00:00:00Z',
              },
            }}
            onEdit={noop}
            onDelete={noop}
          />,
        )
      })

      expect(screen.getByText('Active')).toBeInTheDocument()
      expect(screen.queryByText('Documenting')).not.toBeInTheDocument()
    })
  })
})
