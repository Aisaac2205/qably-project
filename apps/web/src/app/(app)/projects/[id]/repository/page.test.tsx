import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import RepositoryPage from './page'

describe('RepositoryPage', () => {
  it('awaits Next.js Promise params before rendering the project repository', async () => {
    const page = await RepositoryPage({ params: Promise.resolve({ id: 'proj-1' }) })

    await act(async () => {
      render(page)
    })

    expect(screen.getByText('acme/ecommerce-app')).toBeInTheDocument()
  })
})
