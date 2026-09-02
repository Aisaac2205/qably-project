import { act, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery } from '@/lib/query-test-utils'
import { AccountPlanSection } from '@/features/settings/components/account-plan-section'

describe('AccountPlanSection', () => {
  beforeEach(() => __resetStore())

  it('shows the current plan resolved from the organizations api', async () => {
    await act(async () => {
      renderWithQuery(<AccountPlanSection />)
    })

    expect(screen.getByText('Team')).toBeInTheDocument()
  })

  it('no longer renders quota meters the api cannot back', async () => {
    await act(async () => {
      renderWithQuery(<AccountPlanSection />)
    })

    expect(screen.queryByText('Current Cycle Quota Usage')).not.toBeInTheDocument()
    expect(screen.queryByText(/Up to \d+/)).not.toBeInTheDocument()
  })
})
