import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { DuplicateComparison } from '@/features/ai-review/components/duplicate-comparison'
import { __resetStore } from '@/lib/mock-store'

describe('DuplicateComparison', () => {
  beforeEach(() => __resetStore())

  it('shows a not-found message if the referenced case cannot be resolved', async () => {
    await act(async () => {
      render(
        <DuplicateComparison
          duplicateOfCaseId="does-not-exist"
          similarityScore={0.8}
          projectId="proj-1"
        />,
      )
    })
    expect(screen.getByText(/could not be located/i)).toBeInTheDocument()
  })

  it('shows the similarity percentage', async () => {
    await act(async () => {
      render(
        <DuplicateComparison
          duplicateOfCaseId="does-not-exist"
          similarityScore={0.86}
          projectId="proj-1"
        />,
      )
    })
    expect(screen.getByText('86%')).toBeInTheDocument()
  })
})
