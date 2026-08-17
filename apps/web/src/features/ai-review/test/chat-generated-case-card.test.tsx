import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ChatGeneratedCaseCard } from '@/features/ai-review/components/chat-generated-case-card'
import { __resetStore, sendChatMessage, getProposalForAiReviewCase } from '@/lib/mock-store'

describe('ChatGeneratedCaseCard', () => {
  beforeEach(() => __resetStore())

  it('shows the generated proposal title and a link to view it', async () => {
    const onView = vi.fn()
    const user = userEvent.setup()
    const { assistantMessage } = sendChatMessage('proj-1', 'Genera un caso de prueba para el login con 2FA')
    const caseId = assistantMessage.generatedCaseIds![0]

    // A chat-drafted case must be governed by the same ExtractedProposal
    // contract as repository-detected cases — Fase 3 review queue reads
    // proposals, not AiCase, so the bridge must exist before rendering.
    expect(getProposalForAiReviewCase(caseId)?.status).toBe('in_review')

    await act(async () => {
      render(<ChatGeneratedCaseCard caseId={caseId} onView={onView} />)
    })
    expect(screen.getByText(/Case drafted from chat/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'View in Review Queue' }))
    expect(onView).toHaveBeenCalledWith(caseId)
  })

  it('renders nothing if the proposal cannot be found', async () => {
    const { container } = render(<ChatGeneratedCaseCard caseId="missing" onView={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
