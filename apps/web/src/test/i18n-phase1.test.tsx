import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import NotificationsPage from '@/app/(app)/notifications/page'
import ReviewInboxPage from '@/app/(app)/review-inbox/page'
import { useI18nStore } from '@/lib/i18n'
import { renderWithQuery } from '@/lib/query-test-utils'
import en from '@/locales/en.json'
import es from '@/locales/es.json'

function keyPaths(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof nested === 'object' && nested !== null
      ? keyPaths(nested as Record<string, unknown>, path)
      : [path]
  })
}

describe('Phase 1 i18n', () => {
  it('keeps navigation, repository, and temporary-state translation keys in parity', () => {
    const phaseOneEnglish = {
      sidebar: en.sidebar,
      reviewInbox: en.reviewInbox,
      notifications: en.notifications,
      repository: en.repository,
      status: en.status,
      integrations: en.modules.integrations,
    }
    const phaseOneSpanish = {
      sidebar: es.sidebar,
      reviewInbox: es.reviewInbox,
      notifications: es.notifications,
      repository: es.repository,
      status: es.status,
      integrations: es.modules.integrations,
    }

    expect(keyPaths(phaseOneSpanish)).toEqual(keyPaths(phaseOneEnglish))
    expect(keyPaths(es.repository)).toEqual(keyPaths(en.repository))
  })

  it('renders the Notifications page in Spanish', () => {
    useI18nStore.setState({ locale: 'es' })
    renderWithQuery(<NotificationsPage />)

    expect(screen.getByRole('heading', { level: 1, name: 'Notificaciones' })).toBeInTheDocument()
    expect(screen.getByText('Alertas de ejecuciones críticas, propuestas de revisión y riesgos de calidad.')).toBeInTheDocument()
  })

  it('renders the Review Inbox page in Spanish without a duplicate page heading', () => {
    useI18nStore.setState({ locale: 'es' })
    renderWithQuery(<ReviewInboxPage />)

    // The shell owns the single h1 for this route; the page itself renders none.
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(screen.getByText(/^Autoridad humana requerida para la publicación\.$/i)).toBeInTheDocument()
    expect(
      screen.getByText(/La IA extrae propuestas estructuradas desde el código del repositorio/i),
    ).toBeInTheDocument()
  })
})

