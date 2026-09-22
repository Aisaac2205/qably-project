import { screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ChatGeneratedCaseCard } from '@/features/ai-review/components/chat-generated-case-card'
import type { AttachedCaseRecord, SuggestedCaseRecord } from '@qably/types'
import * as chatApi from '@/features/ai-review/api/chat.api'
import { renderWithQuery } from '@/lib/query-test-utils'
import { ApiError } from '@/lib/api-client'

const suggestedCase: SuggestedCaseRecord = {
  title: 'Login with 2FA shows a verification prompt',
  objective: 'Verify the 2FA flow',
  preconditions: [],
  steps: ['Enter credentials', 'Enter the 2FA code'],
  expectedResult: 'User is redirected to the dashboard',
  priority: 'high',
}

const targetedCase: SuggestedCaseRecord = {
  ...suggestedCase,
  targetTestCaseId: 'tc-1',
}

const attachedCases: AttachedCaseRecord[] = [
  { id: 'tc-1', name: 'Valid login redirects to dashboard', suiteName: 'Authentication' },
]

describe('ChatGeneratedCaseCard', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the suggested case title and a send-to-review action', async () => {
    await act(async () => {
      renderWithQuery(
        <ChatGeneratedCaseCard
          projectId="proj-1"
          threadId="thread-1"
          messageId="message-1"
          caseIndex={0}
          suggestedCase={suggestedCase}
        />,
      )
    })
    expect(screen.getByText('Login with 2FA shows a verification prompt')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send to review' })).toBeInTheDocument()
  })

  it('sends the case to review and shows a link to the review queue', async () => {
    vi.spyOn(chatApi, 'sendToReview').mockResolvedValue({ proposalId: 'proposal-1' })
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(
        <ChatGeneratedCaseCard
          projectId="proj-1"
          threadId="thread-1"
          messageId="message-1"
          caseIndex={2}
          suggestedCase={suggestedCase}
        />,
      )
    })

    await user.click(screen.getByRole('button', { name: 'Send to review' }))

    expect(chatApi.sendToReview).toHaveBeenCalledWith('proj-1', 'thread-1', 'message-1', 2)
    expect(await screen.findByRole('link', { name: 'View in Review Queue' })).toHaveAttribute(
      'href',
      '/review-inbox?project=proj-1',
    )
  })

  it('shows the sent state from sentProposalId without a button after a remount', async () => {
    const sendSpy = vi.spyOn(chatApi, 'sendToReview')
    await act(async () => {
      renderWithQuery(
        <ChatGeneratedCaseCard
          projectId="proj-1"
          threadId="thread-1"
          messageId="message-1"
          caseIndex={0}
          suggestedCase={suggestedCase}
          sentProposalId="already-sent-proposal"
        />,
      )
    })

    expect(screen.getByRole('link', { name: 'View in Review Queue' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send to review' })).not.toBeInTheDocument()
    expect(sendSpy).not.toHaveBeenCalled()
  })

  it('shows an error message when sending to review fails', async () => {
    vi.spyOn(chatApi, 'sendToReview').mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(
        <ChatGeneratedCaseCard
          projectId="proj-1"
          threadId="thread-1"
          messageId="message-1"
          caseIndex={0}
          suggestedCase={suggestedCase}
        />,
      )
    })

    await user.click(screen.getByRole('button', { name: 'Send to review' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't send this case/i)
  })

  it('shows a proposal-ready state label before sending', async () => {
    await act(async () => {
      renderWithQuery(
        <ChatGeneratedCaseCard
          projectId="proj-1"
          threadId="thread-1"
          messageId="message-1"
          caseIndex={0}
          suggestedCase={suggestedCase}
        />,
      )
    })
    expect(screen.getByText('Proposal ready')).toBeInTheDocument()
  })

  it('shows a sent state label once a proposal already exists', async () => {
    await act(async () => {
      renderWithQuery(
        <ChatGeneratedCaseCard
          projectId="proj-1"
          threadId="thread-1"
          messageId="message-1"
          caseIndex={0}
          suggestedCase={suggestedCase}
          sentProposalId="already-sent-proposal"
        />,
      )
    })
    expect(screen.getByText('Sent to review')).toBeInTheDocument()
  })

  it('shows a compact what-changed list for a targeted case', async () => {
    await act(async () => {
      renderWithQuery(
        <ChatGeneratedCaseCard
          projectId="proj-1"
          threadId="thread-1"
          messageId="message-1"
          caseIndex={0}
          suggestedCase={targetedCase}
          attachedCases={attachedCases}
        />,
      )
    })
    expect(screen.getByText('What Aeris proposes')).toBeInTheDocument()
    expect(screen.getByText('Objective')).toBeInTheDocument()
    expect(screen.getByText('Steps')).toBeInTheDocument()
    expect(screen.getByText('Expected result')).toBeInTheDocument()
  })

  it('shows which case a targeted proposal updates', async () => {
    await act(async () => {
      renderWithQuery(
        <ChatGeneratedCaseCard
          projectId="proj-1"
          threadId="thread-1"
          messageId="message-1"
          caseIndex={0}
          suggestedCase={targetedCase}
          attachedCases={attachedCases}
        />,
      )
    })
    expect(screen.getByText('Updates: Valid login redirects to dashboard')).toBeInTheDocument()
  })

  it('shows a human-documented conflict message instead of the generic error', async () => {
    vi.spyOn(chatApi, 'sendToReview').mockRejectedValue(
      new ApiError(409, 'Conflict', 'human-documented'),
    )
    const user = userEvent.setup()
    await act(async () => {
      renderWithQuery(
        <ChatGeneratedCaseCard
          projectId="proj-1"
          threadId="thread-1"
          messageId="message-1"
          caseIndex={0}
          suggestedCase={targetedCase}
          attachedCases={attachedCases}
        />,
      )
    })

    await user.click(screen.getByRole('button', { name: 'Send to review' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/documented by a person/i)
  })
})
