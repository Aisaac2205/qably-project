import { screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ChatGeneratedCaseCard } from '@/features/ai-review/components/chat-generated-case-card'
import type { SuggestedCaseRecord } from '@qably/types'
import * as chatApi from '@/features/ai-review/api/chat.api'
import { renderWithQuery } from '@/lib/query-test-utils'

const suggestedCase: SuggestedCaseRecord = {
  title: 'Login with 2FA shows a verification prompt',
  objective: 'Verify the 2FA flow',
  preconditions: [],
  steps: ['Enter credentials', 'Enter the 2FA code'],
  expectedResult: 'User is redirected to the dashboard',
  priority: 'high',
}

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
      '/projects/proj-1/ai-review',
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
})
