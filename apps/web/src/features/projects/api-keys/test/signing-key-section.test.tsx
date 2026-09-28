import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useI18nStore } from '@/lib/i18n'
import {
  getProjectRepository,
  rotateWebhookSecret,
} from '@/features/projects/repository/api/repository.api'
import { SigningKeySection } from '../components/signing-key-section'

vi.mock('@/features/projects/repository/api/repository.api', () => ({
  getProjectRepository: vi.fn(),
  rotateWebhookSecret: vi.fn(),
}))

const rotateSecret = vi.mocked(rotateWebhookSecret)
const getRepository = vi.mocked(getProjectRepository)

async function renderSection() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        <SigningKeySection projectId="proj-1" />
      </QueryClientProvider>,
    )
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

describe('SigningKeySection', () => {
  beforeEach(() => {
    getRepository.mockResolvedValue({
      source: 'github',
      githubRepo: 'acme/app',
      connectedAt: '2026-01-01T00:00:00Z',
    } as unknown as Awaited<ReturnType<typeof getProjectRepository>>)
    rotateSecret.mockResolvedValue({ webhookSecret: 'f'.repeat(64) })
  })

  afterEach(() => {
    act(() => {
      useI18nStore.setState({ locale: 'en' })
    })
    rotateSecret.mockReset()
  })

  it('offers rotating the signing key', async () => {
    await renderSection()

    expect(screen.getByRole('button', { name: 'Rotate key' })).toBeInTheDocument()
    expect(rotateSecret).not.toHaveBeenCalled()
  })

  it('warns before rotating and reveals the new key once confirmed', async () => {
    const user = userEvent.setup()
    await renderSection()

    await user.click(screen.getByRole('button', { name: 'Rotate key' }))

    const confirm = await screen.findByRole('alertdialog').catch(() => screen.getByRole('dialog'))
    expect(within(confirm).getByText(/stops being valid immediately/i)).toBeInTheDocument()

    await user.click(within(confirm).getByRole('button', { name: 'Rotate key' }))

    await waitFor(() => {
      expect(rotateSecret).toHaveBeenCalledWith('proj-1')
    })
    expect(await screen.findByText('f'.repeat(64))).toBeInTheDocument()
  })

  it('reports a rotation that fails without revealing a key', async () => {
    const user = userEvent.setup()
    rotateSecret.mockRejectedValue(new Error('nope'))
    await renderSection()

    await user.click(screen.getByRole('button', { name: 'Rotate key' }))
    const confirm = await screen.findByRole('alertdialog').catch(() => screen.getByRole('dialog'))
    await user.click(within(confirm).getByRole('button', { name: 'Rotate key' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The key could not be rotated. Try again.',
    )
    expect(screen.queryByText('f'.repeat(64))).not.toBeInTheDocument()
  })

  it('translates the signing key labels in Spanish', async () => {
    await act(async () => {
      useI18nStore.setState({ locale: 'es' })
    })

    await renderSection()

    expect(screen.getByRole('heading', { level: 2, name: 'Clave de firma' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rotar clave' })).toBeInTheDocument()
  })
})
