import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ReviewInboxPage from './page'

describe('ReviewInboxPage', () => {
  it('renders an honest temporary state instead of redirecting elsewhere', () => {
    render(<ReviewInboxPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Review Inbox' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'This area is not available yet' })).toBeInTheDocument()
    expect(screen.getByText('Review items will appear here when the review workflow is introduced.')).toBeInTheDocument()
  })
})
