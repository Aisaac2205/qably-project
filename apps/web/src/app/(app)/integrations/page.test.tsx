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

  it('keeps CI and notification integrations while excluding SCM sources', async () => {
    await act(async () => {
      render(<IntegrationsPage />)
    })

    expect(screen.getByRole('columnheader', { name: 'Service' })).toBeInTheDocument()
    expect(screen.getAllByText('GitHub Actions').length).toBeGreaterThan(0)
    expect(within(desktopTable()).getByText('Gmail')).toBeInTheDocument()
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

    const ciItem = within(mobileList).getByText('GitHub Actions').closest('li')
    expect(within(ciItem!).getByRole('button', { name: 'Simulate CI' })).toBeInTheDocument()
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

  it('recovers from a non-OK CI simulation response without replacing the focused action', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValueOnce({ ok: true, status: 204 })
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => {
      render(<IntegrationsPage />)
    })

    const simulate = within(desktopTable()).getByRole('button', { name: 'Simulate CI' })
    simulate.focus()
    await user.click(simulate)

    expect(screen.getByRole('alert')).toHaveTextContent('CI simulation failed')
    expect(screen.getByRole('alert')).toHaveTextContent('could not be completed')
    expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP 502')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(within(desktopTable()).getByRole('button', { name: 'Retry simulation' })).toBe(simulate)
    expect(simulate).toHaveFocus()
    expect(simulate).toBeEnabled()

    await user.click(simulate)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(within(desktopTable()).getByRole('button', { name: 'Simulate CI' })).toBe(simulate)
    expect(simulate).toHaveFocus()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('maps a rejected CI simulation request to a safe localized network message', async () => {
    const user = userEvent.setup()
    const rawError = 'proxy https://ci.internal.example/api failed for endpoint /api/webhooks/ci/github'
    const fetchMock = vi.fn().mockRejectedValue(new Error(rawError))
    vi.stubGlobal('fetch', fetchMock)
    useI18nStore.setState({ locale: 'es' })

    await act(async () => {
      render(<IntegrationsPage />)
    })

    const table = screen.getByRole('table', { name: 'Integraciones' })
    await user.click(within(table).getByRole('button', { name: 'Simular CI' }))

    expect(screen.getByRole('alert')).toHaveTextContent('La simulación de CI falló')
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos conectarnos')
    expect(screen.getByRole('alert')).not.toHaveTextContent(rawError)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(within(table).getByRole('button', { name: 'Reintentar simulación' })).toBeEnabled()
  })

  it('disables the stable CI simulation action while a request is in flight', async () => {
    const user = userEvent.setup()
    let resolveResponse: (response: { ok: boolean; status: number }) => void = () => undefined
    const response = new Promise<{ ok: boolean; status: number }>((resolve) => {
      resolveResponse = resolve
    })
    const fetchMock = vi.fn().mockReturnValue(response)
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => {
      render(<IntegrationsPage />)
    })

    const simulate = within(desktopTable()).getByRole('button', { name: 'Simulate CI' })
    await user.click(simulate)

    expect(simulate).toBeDisabled()
    await user.click(simulate)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveResponse({ ok: true, status: 204 })
      await response
    })

    expect(simulate).toBeEnabled()
  })

  it('keeps the retry action available and focused after repeated CI simulation failures', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 })
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => {
      render(<IntegrationsPage />)
    })

    const simulate = within(desktopTable()).getByRole('button', { name: 'Simulate CI' })
    simulate.focus()
    await user.click(simulate)
    await user.click(simulate)

    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByRole('alert')).toHaveTextContent('could not be completed')
    expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP 503')
    expect(within(desktopTable()).getByRole('button', { name: 'Retry simulation' })).toBe(simulate)
    expect(simulate).toHaveFocus()
    expect(simulate).toBeEnabled()
    expect(fetchMock).toHaveBeenCalledTimes(2)
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
