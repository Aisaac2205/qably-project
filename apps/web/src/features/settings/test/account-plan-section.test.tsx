import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { __resetStore } from '@/lib/mock-store'
import { AccountPlanSection } from '@/features/settings/components/account-plan-section'

describe('AccountPlanSection', () => {
  beforeEach(() => __resetStore())

  it('shows the current plan and its read-only limits', async () => {
    await act(async () => {
      render(<AccountPlanSection />)
    })

    expect(screen.getByText('Team')).toBeInTheDocument()
    expect(screen.getByText('Projects')).toBeInTheDocument()
    expect(screen.getByText('Members')).toBeInTheDocument()
    expect(screen.getAllByText('Up to 20')).toHaveLength(1)
    expect(screen.getAllByText('Up to 10')).toHaveLength(1)
    expect(screen.getAllByText('Up to 5000')).toHaveLength(1)
  })
})
