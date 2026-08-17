import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AiCasesOverview } from '@/features/dashboard/components/ai-cases-overview'

describe('AiCasesOverview', () => {
  it('renders the title "AI cases overview"', async () => {
    await act(async () => {
      render(<AiCasesOverview />)
    })
    expect(screen.getByText('AI cases overview')).toBeInTheDocument()
  })

  it('renders the total count for the review queue', async () => {
    await act(async () => {
      render(<AiCasesOverview />)
    })
    expect(screen.getByText('56')).toBeInTheDocument()
  })

  it('renders a labelled progressbar for each review state', async () => {
    await act(async () => {
      render(<AiCasesOverview />)
    })

    expect(screen.getByRole('progressbar', { name: 'Ready' })).toHaveAttribute('aria-valuenow', '24')
    expect(screen.getByRole('progressbar', { name: 'Generated' })).toHaveAttribute('aria-valuenow', '18')
    expect(screen.getByRole('progressbar', { name: 'In review' })).toHaveAttribute('aria-valuenow', '8')
    expect(screen.getByRole('progressbar', { name: 'Rejected' })).toHaveAttribute('aria-valuenow', '6')
  })
})