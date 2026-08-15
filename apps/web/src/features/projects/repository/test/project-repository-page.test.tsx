import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useI18nStore } from '@/lib/i18n'
import { __resetStore } from '@/lib/mock-store'
import { ProjectRepositoryPage } from '../components/project-repository-page'

describe('ProjectRepositoryPage', () => {
  afterEach(() => {
    act(() => {
      useI18nStore.setState({ locale: 'en' })
      __resetStore()
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

  it('presents the completed simulated ingestion with inspectable evidence', async () => {
    await act(async () => {
      render(<ProjectRepositoryPage projectId="proj-1" />)
    })

    expect(screen.getByRole('heading', { level: 2, name: 'Ingestion' })).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getAllByText('Repository')).toHaveLength(2)
    expect(screen.getByText('Jun 16, 2026, 10:45 AM')).toBeInTheDocument()
    expect(screen.getByText('PR #184')).toBeInTheDocument()
    expect(screen.getByText('8f3c2a1')).toBeInTheDocument()
    expect(screen.getByText('tests/checkout/empty-cart.spec.ts')).toBeInTheDocument()
    expect(screen.getByText(/checkoutButton\)\.toBeDisabled/)).toBeInTheDocument()
    expect(screen.getByText('mock://acme/ecommerce-app/pull/184/files/tests/checkout/empty-cart.spec.ts')).toBeInTheDocument()
    expect(screen.getByText('This is simulated source data, not a live provider connection.')).toBeInTheDocument()
  })

  it('translates ingestion labels in Spanish', async () => {
    await act(async () => {
      useI18nStore.setState({ locale: 'es' })
    })

    await act(async () => {
      render(<ProjectRepositoryPage projectId="proj-1" />)
    })

    expect(screen.getByRole('heading', { level: 2, name: 'Ingesta' })).toBeInTheDocument()
    expect(screen.getByText('Completado')).toBeInTheDocument()
    expect(screen.getByText('Solicitud de extracción')).toBeInTheDocument()
    expect(screen.getByText('Confirmación')).toBeInTheDocument()
    expect(screen.getByText('Archivo')).toBeInTheDocument()
    expect(screen.getByText('Diferencia')).toBeInTheDocument()
    expect(screen.getByText('Origen')).toBeInTheDocument()
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
