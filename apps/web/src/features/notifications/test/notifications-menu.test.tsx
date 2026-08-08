import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import { __resetStore } from '@/lib/mock-store'
import { NotificationsMenu } from '@/features/notifications/components/notifications-menu'

describe('NotificationsMenu', () => {
  beforeEach(() => __resetStore())

  it('shows unread notifications and marks one as read', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<NotificationsMenu />)
    })

    await user.click(screen.getByRole('button', { name: /notifications, 2 unread/i }))
    expect(screen.getByText('Password reset flow failed in Run #12.')).toBeInTheDocument()
    expect(screen.getAllByText('Critical')).toHaveLength(2)

    await user.click(screen.getByText('Password reset flow failed in Run #12.'))
    expect(screen.getByRole('button', { name: /notifications, 1 unread/i })).toBeInTheDocument()
  })
})
