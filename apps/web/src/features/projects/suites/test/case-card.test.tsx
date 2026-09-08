import { screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { CaseCard } from '@/features/projects/suites/components/case-card'
import type { TestCase } from '@qably/types'
import { renderWithQuery } from '@/lib/query-test-utils'
import { ApiError } from '@/lib/api-client'
import * as suitesApi from '@/features/projects/suites/api/suites.api'

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

  describe('AI documentation for automated cases', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('offers to document an automated case with AI instead of the manual editor', async () => {
      await act(async () => {
        renderWithQuery(<CaseCard testCase={automatedCase} projectId="proj-1" onEdit={noop} onDelete={noop} />)
      })

      expect(screen.getByRole('button', { name: /document with ai/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /^document this case$/i })).not.toBeInTheDocument()
    })

    it('queues AI documentation and shows a confirmation linking to AI Review', async () => {
      vi.spyOn(suitesApi, 'documentCase').mockResolvedValue({ queued: true, jobId: 'job-1' })
      const user = userEvent.setup()
      await act(async () => {
        renderWithQuery(<CaseCard testCase={automatedCase} projectId="proj-1" onEdit={noop} onDelete={noop} />)
      })

      await user.click(screen.getByRole('button', { name: /document with ai/i }))

      expect(await screen.findByText(/queued for ai documentation/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /view in ai review/i })).toBeInTheDocument()
      expect(suitesApi.documentCase).toHaveBeenCalledWith('suite-1', 'tc-9')
    })

    it('shows a generic conflict message when the 409 has no recognized code', async () => {
      vi.spyOn(suitesApi, 'documentCase').mockRejectedValue(new ApiError(409, 'Conflict'))
      const user = userEvent.setup()
      await act(async () => {
        renderWithQuery(<CaseCard testCase={automatedCase} projectId="proj-1" onEdit={noop} onDelete={noop} />)
      })

      await user.click(screen.getByRole('button', { name: /document with ai/i }))

      expect(await screen.findByText(/can't be documented with ai right now/i)).toBeInTheDocument()
    })

    it('shows a not-automated message when the case has no automation file', async () => {
      vi.spyOn(suitesApi, 'documentCase').mockRejectedValue(new ApiError(409, 'Conflict', 'not-automated'))
      const user = userEvent.setup()
      await act(async () => {
        renderWithQuery(<CaseCard testCase={automatedCase} projectId="proj-1" onEdit={noop} onDelete={noop} />)
      })

      await user.click(screen.getByRole('button', { name: /document with ai/i }))

      expect(await screen.findByText(/isn't automated or has no automation file/i)).toBeInTheDocument()
    })

    it('explains that no repository file matches and offers manual documentation', async () => {
      vi.spyOn(suitesApi, 'documentCase').mockRejectedValue(new ApiError(409, 'Conflict', 'no-source-file'))
      const onEdit = vi.fn()
      const user = userEvent.setup()
      await act(async () => {
        renderWithQuery(<CaseCard testCase={automatedCase} projectId="proj-1" onEdit={onEdit} onDelete={noop} />)
      })

      await user.click(screen.getByRole('button', { name: /document with ai/i }))

      expect(await screen.findByText(/no matching test file in the connected repository/i)).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /document manually/i }))
      expect(onEdit).toHaveBeenCalledWith(automatedCase)
    })

    it('shows an already-pending message when a proposal is already pending review', async () => {
      vi.spyOn(suitesApi, 'documentCase').mockRejectedValue(new ApiError(409, 'Conflict', 'already-pending'))
      const user = userEvent.setup()
      await act(async () => {
        renderWithQuery(<CaseCard testCase={automatedCase} projectId="proj-1" onEdit={noop} onDelete={noop} />)
      })

      await user.click(screen.getByRole('button', { name: /document with ai/i }))

      expect(await screen.findByText(/already a proposal pending review|already pending review for this case/i)).toBeInTheDocument()
    })

    it('shows a not-found message when the case no longer exists', async () => {
      vi.spyOn(suitesApi, 'documentCase').mockRejectedValue(new ApiError(404, 'Not found'))
      const user = userEvent.setup()
      await act(async () => {
        renderWithQuery(<CaseCard testCase={automatedCase} projectId="proj-1" onEdit={noop} onDelete={noop} />)
      })

      await user.click(screen.getByRole('button', { name: /document with ai/i }))

      expect(await screen.findByText(/could no longer be found/i)).toBeInTheDocument()
    })

    it('shows an ai-not-enabled message when the organization lacks the AI entitlement', async () => {
      vi.spyOn(suitesApi, 'documentCase').mockRejectedValue(new ApiError(403, 'Forbidden', 'ai-not-enabled'))
      const user = userEvent.setup()
      await act(async () => {
        renderWithQuery(<CaseCard testCase={automatedCase} projectId="proj-1" onEdit={noop} onDelete={noop} />)
      })

      await user.click(screen.getByRole('button', { name: /document with ai/i }))

      expect(await screen.findByText(/ai documentation isn't enabled/i)).toBeInTheDocument()
    })

    it('shows a throttled message on 429', async () => {
      vi.spyOn(suitesApi, 'documentCase').mockRejectedValue(new ApiError(429, 'Too Many Requests'))
      const user = userEvent.setup()
      await act(async () => {
        renderWithQuery(<CaseCard testCase={automatedCase} projectId="proj-1" onEdit={noop} onDelete={noop} />)
      })

      await user.click(screen.getByRole('button', { name: /document with ai/i }))

      expect(await screen.findByText(/too many ai requests/i)).toBeInTheDocument()
    })

    it('hides the Document with AI button after a successful queue so a second click cannot race an already-pending error', async () => {
      vi.spyOn(suitesApi, 'documentCase').mockResolvedValue({ queued: true, jobId: 'job-1' })
      const user = userEvent.setup()
      await act(async () => {
        renderWithQuery(<CaseCard testCase={automatedCase} projectId="proj-1" onEdit={noop} onDelete={noop} />)
      })

      await user.click(screen.getByRole('button', { name: /document with ai/i }))

      expect(await screen.findByText(/queued for ai documentation/i)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /document with ai/i })).not.toBeInTheDocument()
    })

    it('disables the button while the request is pending', async () => {
      let resolveRequest: (value: { queued: true; jobId: string }) => void = () => {}
      vi.spyOn(suitesApi, 'documentCase').mockReturnValue(
        new Promise((resolve) => { resolveRequest = resolve }),
      )
      const user = userEvent.setup()
      await act(async () => {
        renderWithQuery(<CaseCard testCase={automatedCase} projectId="proj-1" onEdit={noop} onDelete={noop} />)
      })

      const button = screen.getByRole('button', { name: /document with ai/i })
      await user.click(button)

      expect(await screen.findByRole('button', { name: /documenting with ai/i })).toBeDisabled()

      await act(async () => {
        resolveRequest({ queued: true, jobId: 'job-1' })
      })
    })
  })
})
