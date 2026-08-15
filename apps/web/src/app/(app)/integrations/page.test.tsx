import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetStore } from '@/lib/mock-store'
import { useI18nStore } from '@/lib/i18n'
import IntegrationsPage from './page'

describe('IntegrationsPage', () => {
  const desktopTable = () => screen.getByRole('table', { name: 'Integrations' })

  beforeEach(() => {
    __resetStore()
    act(() => {
      useI18nStore.setState({ locale: 'en' })
    })
  })

  afterEach(() => {
    act(() => {
      useI18nStore.setState({ locale: 'en' })
    })
    vi.unstubAllGlobals()
  })

  it('keeps notification integrations while excluding SCM and CI sources', async () => {
    await act(async () => {
      render(<IntegrationsPage />)
    })

    expect(screen.getByRole('columnheader', { name: 'Service' })).toBeInTheDocument()
    expect(within(desktopTable()).getByText('Gmail')).toBeInTheDocument()
    expect(within(desktopTable()).queryByText('GitHub Actions')).not.toBeInTheDocument()
    expect(within(desktopTable()).queryByText('GitHub')).not.toBeInTheDocument()
    expect(within(desktopTable()).queryByText('Bitbucket')).not.toBeInTheDocument()
    expect(screen.getByText('Recent activity')).toBeInTheDocument()
  })

  it('uses a semantic mobile list with all primary decisions available at 320px', async () => {
    const user = userEvent.setup()
    render(<IntegrationsPage />)

    const mobileList = screen.getByRole('list', { name: 'Integrations' })
    expect(within(mobileList).queryByText('GitHub')).not.toBeInTheDocument()
    expect(within(mobileList).queryByText('Bitbucket')).not.toBeInTheDocument()
    expect(within(mobileList).queryByText('GitHub Actions')).not.toBeInTheDocument()
    const gmailItem = within(mobileList).getByText('Gmail').closest('li')
    expect(gmailItem).not.toBeNull()
    expect(within(gmailItem!).getByText('Available')).toBeInTheDocument()
    expect(within(gmailItem!).getByText('Connected resource')).toBeInTheDocument()
    expect(within(gmailItem!).getByText('Notifications and reports')).toBeInTheDocument()
    expect(within(gmailItem!).getByText('Last activity')).toBeInTheDocument()
    const connect = within(gmailItem!).getByRole('button', { name: 'Connect' })
    connect.focus()
    await user.keyboard('{Enter}')
    expect(connect).toHaveFocus()
    expect(within(gmailItem!).getByText('Connected')).toBeInTheDocument()
  })

  it('connects Gmail from the table action', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<IntegrationsPage />)
    })

    const gmailRow = within(desktopTable()).getByText('Gmail').closest('tr')
    expect(gmailRow).not.toBeNull()
    await user.click(within(gmailRow!).getByRole('button', { name: 'Connect' }))

    expect(within(gmailRow!).getByText('Connected')).toBeInTheDocument()
  })

  it('localizes the complete primary Integrations workflow in Spanish', async () => {
    useI18nStore.setState({ locale: 'es' })
    render(<IntegrationsPage />)

    expect(screen.getByRole('button', { name: 'Agregar integración' })).toBeInTheDocument()
    const mobileList = screen.getByRole('list', { name: 'Integraciones' })
    const gmailItem = within(mobileList).getByText('Gmail').closest('li')
    expect(within(gmailItem!).getByText('Disponible')).toBeInTheDocument()
    expect(within(gmailItem!).getByText('Recurso conectado')).toBeInTheDocument()
    expect(within(gmailItem!).getByRole('button', { name: 'Conectar' })).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: 'Actividad reciente' })).toHaveTextContent('Alerta #1245 entregada')
  })
})
