import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery } from '@/lib/query-test-utils'
import NotificationsPage from './page'

describe('NotificationsPage', () => {
  beforeEach(() => __resetStore())

  it('renders the interactive notifications center with real notifications and action links', async () => {
    const user = userEvent.setup()
    renderWithQuery(<NotificationsPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument()
    expect(screen.getByText('Password reset flow failed in Run #12.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /unread/i })).toBeInTheDocument()

    // Check action link to run detail
    const runLinks = screen.getAllByRole('link', { name: /view run/i })
    expect(runLinks.length).toBeGreaterThan(0)
    expect(runLinks[0]).toHaveAttribute('href', '/projects/proj-1/runs/run-12')

    // Filter to read only
    await user.click(screen.getByRole('tab', { name: 'Read' }))
    expect(screen.getByText('Discount calculation regression needs review.')).toBeInTheDocument()
    expect(screen.queryByText('Password reset flow failed in Run #12.')).not.toBeInTheDocument()
  })

  it('allows marking all notifications as read', async () => {
    const user = userEvent.setup()
    renderWithQuery(<NotificationsPage />)

    const markAllBtn = screen.getByRole('button', { name: /mark all as read/i })
    await user.click(markAllBtn)

    // Unread count should become 0 and mark all button disappears
    expect(screen.queryByRole('button', { name: /mark all as read/i })).not.toBeInTheDocument()
  })
})
