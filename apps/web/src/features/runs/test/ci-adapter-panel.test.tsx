import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CiAdapterPanel } from '@/features/runs/components/ci-adapter-panel'
import { __resetStore } from '@/lib/mock-store'
import { useI18nStore } from '@/lib/i18n'

describe('CiAdapterPanel', () => {
  beforeEach(() => {
    __resetStore()
  })

  afterEach(() => {
    act(() => {
      useI18nStore.setState({ locale: 'en' })
    })
    vi.unstubAllGlobals()
  })

  it('renders the CI connection matched to the project repository', async () => {
    await act(async () => {
      render(<CiAdapterPanel projectId="proj-1" />)
    })

    expect(screen.getByRole('heading', { name: 'CI adapter' })).toBeInTheDocument()
    expect(screen.getByText('acme/ecommerce-app')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Simulate CI' })).toBeInTheDocument()
  })

  it('renders nothing when the project has no matching CI connection', async () => {
    const { container } = await act(async () => {
      return render(<CiAdapterPanel projectId="proj-2" />)
    })

    expect(container).toBeEmptyDOMElement()
  })

  it('recovers from a non-OK CI simulation response without replacing the focused action', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 502 })
      .mockResolvedValueOnce({ ok: true, status: 204 })
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => {
      render(<CiAdapterPanel projectId="proj-1" />)
    })

    const simulate = screen.getByRole('button', { name: 'Simulate CI' })
    simulate.focus()
    await user.click(simulate)

    expect(screen.getByRole('alert')).toHaveTextContent('CI simulation failed')
    expect(screen.getByRole('alert')).toHaveTextContent('could not be completed')
    expect(screen.getByRole('button', { name: 'Retry simulation' })).toBe(simulate)
    expect(simulate).toHaveFocus()

    await user.click(simulate)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('maps a rejected CI simulation request to a safe localized network message', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockRejectedValue(new Error('proxy https://ci.internal.example failed'))
    vi.stubGlobal('fetch', fetchMock)
    useI18nStore.setState({ locale: 'es' })

    await act(async () => {
      render(<CiAdapterPanel projectId="proj-1" />)
    })

    await user.click(screen.getByRole('button', { name: 'Simular CI' }))

    expect(screen.getByRole('alert')).toHaveTextContent('La simulación de CI falló')
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos conectarnos')
    expect(screen.getByRole('alert')).not.toHaveTextContent('proxy https://ci.internal.example failed')
  })

  it('disables the action while a request is in flight', async () => {
    const user = userEvent.setup()
    let resolveResponse: (response: { ok: boolean; status: number }) => void = () => undefined
    const response = new Promise<{ ok: boolean; status: number }>((resolve) => {
      resolveResponse = resolve
    })
    const fetchMock = vi.fn().mockReturnValue(response)
    vi.stubGlobal('fetch', fetchMock)

    await act(async () => {
      render(<CiAdapterPanel projectId="proj-1" />)
    })

    const simulate = screen.getByRole('button', { name: 'Simulate CI' })
    await user.click(simulate)
    expect(simulate).toBeDisabled()

    await act(async () => {
      resolveResponse({ ok: true, status: 204 })
      await response
    })

    expect(simulate).toBeEnabled()
  })
})
