import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { __resetStore } from '@/lib/mock-store'
import IntegrationsPage from './page'

describe('IntegrationsPage', () => {
  beforeEach(() => __resetStore())

  it('renders the operational table with Gmail as an available channel', async () => {
    await act(async () => {
      render(<IntegrationsPage />)
    })

    expect(screen.getByRole('columnheader', { name: 'Service' })).toBeInTheDocument()
    expect(screen.getAllByText('GitHub Actions').length).toBeGreaterThan(0)
    expect(screen.getByText('Gmail')).toBeInTheDocument()
    expect(screen.getByText('Recent activity')).toBeInTheDocument()
  })

  it('connects Gmail from the table action', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<IntegrationsPage />)
    })

    const gmailRow = screen.getByText('Gmail').closest('tr')
    expect(gmailRow).not.toBeNull()
    await user.click(within(gmailRow!).getByRole('button', { name: 'Connect' }))

    expect(within(gmailRow!).getByText('Connected')).toBeInTheDocument()
  })
})
