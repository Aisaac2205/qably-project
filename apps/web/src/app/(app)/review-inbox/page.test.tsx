import { screen } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'
import ReviewInboxPage from './page'
import { __resetStore } from '@/lib/mock-store'
import { useI18nStore } from '@/lib/i18n'
import { renderWithQuery } from '@/lib/query-test-utils'

describe('ReviewInboxPage route', () => {
  beforeEach(() => {
    __resetStore()
    useI18nStore.setState({ locale: 'en' })
  })

  it('renders the real review inbox workstation without a duplicate page heading', () => {
    const { container } = renderWithQuery(<ReviewInboxPage />)

    // The app shell's TopBar owns the single document h1 for this route
    // (id="page-title"); the page itself must not render a competing one,
    // and instead borrows that heading's accessible name via aria-labelledby.
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(container.querySelector('[aria-labelledby="page-title"]')).toBeInTheDocument()

    expect(screen.getByText(/^Human authority required for publication\.$/i)).toBeInTheDocument()
    expect(
      screen.getByText(/AI extracts test proposals from repository changes/i),
    ).toBeInTheDocument()

    expect(screen.getByRole('searchbox', { name: /Search by title/i })).toBeInTheDocument()
  })
})
