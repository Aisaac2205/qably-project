import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { QualityPageSkeleton } from '@/features/projects/quality/components/quality-page-skeleton'

describe('QualityPageSkeleton', () => {
  it('announces a busy loading state', () => {
    render(<QualityPageSkeleton />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('reserves space for the current pass rate ring next to the trend chart', () => {
    render(<QualityPageSkeleton />)
    const ringPlaceholder = document.querySelector('.rounded-full[data-slot="skeleton"]')
    expect(ringPlaceholder).not.toBeNull()
  })
})
