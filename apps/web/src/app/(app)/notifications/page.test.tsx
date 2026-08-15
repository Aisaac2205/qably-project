import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import NotificationsPage from './page'

describe('NotificationsPage', () => {
  it('renders an honest temporary state instead of redirecting elsewhere', () => {
    render(<NotificationsPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'This area is not available yet' })).toBeInTheDocument()
    expect(screen.getByText('Notifications will appear here when notification delivery is introduced.')).toBeInTheDocument()
  })
})
