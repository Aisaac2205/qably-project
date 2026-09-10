import { screen, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { CaseCard } from '@/features/projects/suites/components/case-card'
import type { TestCase } from '@qably/types'
import { renderWithQuery } from '@/lib/query-test-utils'

const mockCase: TestCase = {
  id: 'tc-1',
  suiteId: 'suite-1',
  version: 2,
  name: 'Valid login redirects to dashboard',
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
  steps: [],
  expectedResult: '',
  priority: 'medium',
  state: 'draft',
  executionMode: 'automated',
  automationKey: 'useCreateRun > redirects to dashboard on valid login',
  automationFilePath: 'src/features/runs/hooks/use-create-run.test.ts',
}

const noop = () => {}

describe('CaseCard', () => {
  it('shows the execution mode badge for a manual case', async () => {
    await act(async () => { renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.getByText('Manual')).toBeInTheDocument()
  })

  it('keeps the version chip from shrinking in the badge row', async () => {
    await act(async () => { renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    const chip = screen.getByText((_, element) => element?.textContent === 'v2' && element.tagName === 'SPAN')
    expect(chip.className).toContain('shrink-0')
  })

  it('shows the execution mode badge for an automated case', async () => {
    await act(async () => { renderWithQuery(<CaseCard testCase={automatedCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.getByText('Automated')).toBeInTheDocument()
  })

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

  it('shows the published version of the case', async () => {
    await act(async () => { renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />) })
    expect(screen.getByText('v2')).toBeInTheDocument()
  })

  it('hides the version badge when the case has never been published', async () => {
    await act(async () => {
      renderWithQuery(<CaseCard testCase={{ ...mockCase, version: null }} onEdit={noop} onDelete={noop} />)
    })
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

  describe('quality health signals', () => {
    it('renders nothing extra for a case with no health signals', async () => {
      await act(async () => {
        renderWithQuery(<CaseCard testCase={mockCase} onEdit={noop} onDelete={noop} />)
      })

      expect(screen.queryByRole('group', { name: /quality signals/i })).not.toBeInTheDocument()
    })

    it('renders a chip per signal the case carries, as a visible label rather than color alone', async () => {
      await act(async () => {
        renderWithQuery(
          <CaseCard
            testCase={{ ...automatedCase, healthSignals: ['no-steps', 'never-run'] }}
            onEdit={noop}
            onDelete={noop}
          />,
        )
      })

      const strip = screen.getByRole('group', { name: /quality signals/i })
      expect(within(strip).getByRole('button', { name: /no steps/i })).toBeInTheDocument()
      expect(within(strip).getByRole('button', { name: /never run/i })).toBeInTheDocument()
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
    it('flags a case documented in another language than the one being viewed', async () => {
      await act(async () => {
        renderWithQuery(
          <CaseCard
            testCase={{ ...mockCase, documentedLocale: 'es' }}
            projectId="proj-1"
            onEdit={noop}
            onDelete={noop}
          />,
        )
      })

      expect(screen.getByText(/documented in spanish/i)).toBeInTheDocument()
    })

    it('stays quiet when the documentation matches the viewer language or was never recorded', async () => {
      await act(async () => {
        renderWithQuery(
          <CaseCard
            testCase={{ ...mockCase, documentedLocale: null }}
            projectId="proj-1"
            onEdit={noop}
            onDelete={noop}
          />,
        )
      })

      expect(screen.queryByText(/documented in/i)).not.toBeInTheDocument()
    })
  })
})
