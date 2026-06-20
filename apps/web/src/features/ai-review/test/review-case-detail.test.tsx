import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ReviewCaseDetail } from '@/features/ai-review/components/review-case-detail'
import type { AiCase } from '@qably/types'

const mockCase: AiCase = {
  id: 'ai-2',
  name: 'Checkout with empty cart blocked',
  steps: ['Navigate to /checkout', 'Observe button state'],
  expectedResult: 'Button disabled, message shown',
  sourceFile: 'checkout.spec.ts',
  sourceSnippet: "it('should block', async () => {\n  await expect(btn).toBeDisabled()\n})",
  reviewStatus: 'pending',
  projectId: 'proj-1',
}

describe('ReviewCaseDetail', () => {
  it('renders case name', async () => {
    await act(async () => {
      render(<ReviewCaseDetail c={mockCase} />)
    })
    expect(screen.getByText('Checkout with empty cart blocked')).toBeInTheDocument()
  })

  it('renders steps', async () => {
    await act(async () => {
      render(<ReviewCaseDetail c={mockCase} />)
    })
    expect(screen.getByText('Navigate to /checkout')).toBeInTheDocument()
    expect(screen.getByText('Observe button state')).toBeInTheDocument()
  })

  it('renders expected result', async () => {
    await act(async () => {
      render(<ReviewCaseDetail c={mockCase} />)
    })
    expect(screen.getByText('Button disabled, message shown')).toBeInTheDocument()
  })

  it('renders code snippet', async () => {
    await act(async () => {
      render(<ReviewCaseDetail c={mockCase} />)
    })
    const code = document.querySelector('code')
    expect(code?.textContent).toContain('should block')
  })
})
