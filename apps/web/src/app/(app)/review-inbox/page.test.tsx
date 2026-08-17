import { render, screen } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'
import ReviewInboxPage from './page'
import { __resetStore } from '@/lib/mock-store'
import { useI18nStore } from '@/lib/i18n'

describe('ReviewInboxPage route', () => {
  beforeEach(() => {
    __resetStore()
    useI18nStore.setState({ locale: 'en' })
  })

  it('renders the real review inbox workstation with KPIs and governance', () => {
    render(<ReviewInboxPage />)

    expect(screen.getByRole('heading', { level: 1, name: /Review Inbox/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: /Human authority required for publication/i })).toBeInTheDocument()
    expect(screen.getAllByText(/Pending review/i).length).toBeGreaterThan(0)
    expect(screen.getByRole('searchbox', { name: /Search by title/i })).toBeInTheDocument()
  })
})

