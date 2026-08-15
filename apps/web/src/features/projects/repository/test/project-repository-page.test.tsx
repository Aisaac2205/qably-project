import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useI18nStore } from '@/lib/i18n'
import { ProjectRepositoryPage } from '../components/project-repository-page'

describe('ProjectRepositoryPage', () => {
  afterEach(() => {
    act(() => {
      useI18nStore.setState({ locale: 'en' })
    })
  })

  it('renders the simulated GitHub source in project context', async () => {
    await act(async () => {
      render(<ProjectRepositoryPage projectId="proj-1" />)
    })

    expect(screen.getByRole('heading', { level: 1, name: 'Repository' })).toBeInTheDocument()
    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('acme/ecommerce-app')).toBeInTheDocument()
    expect(screen.getByText('This is simulated source data, not a live provider connection.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Open integrations' })).not.toBeInTheDocument()
  })

  it('renders a localized no-source state without a fabricated connect action', async () => {
    await act(async () => {
      useI18nStore.setState({ locale: 'es' })
    })

    await act(async () => {
      render(<ProjectRepositoryPage projectId="proj-2" />)
    })

    const description = screen.getByText('Este proyecto no tiene una fuente SCM configurada.')
    expect(description.closest('[data-state-kind]')).toHaveAttribute('data-state-kind', 'no-source')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
