import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { ReviewCaseDetail } from '@/features/ai-review/components/review-case-detail'
import { __resetStore } from '@/lib/mock-store'
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
  source: 'webhook',
}

describe('ReviewCaseDetail', () => {
  beforeEach(() => __resetStore())

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

  it('renders the duplicate comparison card when duplicateOfCaseId is set', async () => {
    const c: AiCase = {
      id: 'ai-x', name: 'Dup case', steps: ['step'], expectedResult: 'result', sourceFile: 'a.spec.ts',
      sourceSnippet: 'code', reviewStatus: 'pending', projectId: 'proj-1',
      source: 'webhook', duplicateOfCaseId: 'case-1', similarityScore: 0.9,
    }
    await act(async () => {
      render(<ReviewCaseDetail c={c} />)
    })
    expect(screen.getByText('Possible duplicate')).toBeInTheDocument()
  })
})
