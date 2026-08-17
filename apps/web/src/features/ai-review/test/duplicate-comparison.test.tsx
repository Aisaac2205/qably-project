import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { DuplicateComparison } from '@/features/ai-review/components/duplicate-comparison'
import { __resetStore } from '@/lib/mock-store'

describe('DuplicateComparison', () => {
  beforeEach(() => __resetStore())

  it('shows a not-found message if the referenced test case cannot be resolved', async () => {
    await act(async () => {
      render(<DuplicateComparison targetOfficialTestCaseId="does-not-exist" />)
    })
    expect(screen.getByText(/could not be located/i)).toBeInTheDocument()
  })

  it('shows the linked test case title when it resolves', async () => {
    await act(async () => {
      render(<DuplicateComparison targetOfficialTestCaseId="case-tc-4" />)
    })
    expect(screen.getByText('Checkout with empty cart blocked')).toBeInTheDocument()
  })
})
