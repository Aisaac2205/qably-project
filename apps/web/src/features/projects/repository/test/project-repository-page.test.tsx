import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ProjectRepositoryView } from '@qably/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useI18nStore } from '@/lib/i18n'
import { __resetStore } from '@/lib/mock-store'
import { getProjectRepository } from '../api/repository.api'
import { ProjectRepositoryPage } from '../components/project-repository-page'

vi.mock('../api/repository.api', () => ({ getProjectRepository: vi.fn() }))

const readRepository = vi.mocked(getProjectRepository)

const view: ProjectRepositoryView = {
  source: {
    provider: 'GITHUB',
    repo: 'acme/ecommerce-app',
    testFilePatterns: ['*.spec.ts', '*.test.ts'],
  },
  batch: {
    id: 'batch-1',
    projectId: 'proj-1',
    source: 'webhook',
    status: 'completed',
    codeChangeIds: ['change-1', 'change-2', 'change-3', 'change-4'],
    createdAt: '2026-06-16T10:45:00Z',
  },
  codeChanges: [
    {
      id: 'change-1', projectId: 'proj-1', pullRequestNumber: 184, commitSha: '8f3c2a1d4e5f',
      filePath: 'tests/checkout/empty-cart.spec.ts',
      diff: '+  await expect(checkoutButton).toBeDisabled()',
      detectedPattern: '*.spec.ts', evidenceId: 'evidence-1',
    },
    {
      id: 'change-2', projectId: 'proj-1', pullRequestNumber: 184, commitSha: '8f3c2a1d4e5f',
      filePath: 'tests/checkout/cart-total.test.ts',
      diff: '+  expect(total).toBe(42)', detectedPattern: '*.test.ts', evidenceId: 'evidence-2',
    },
    {
      id: 'change-3', projectId: 'proj-1', pullRequestNumber: 184, commitSha: '8f3c2a1d4e5f',
      filePath: 'src/checkout/cart-service.ts', diff: '+  return total', evidenceId: 'evidence-3',
    },
    {
      id: 'change-4', projectId: 'proj-1', pullRequestNumber: 184, commitSha: '8f3c2a1d4e5f',
      filePath: 'docs/checkout.md', diff: '+ Updated checkout guidance', evidenceId: 'evidence-4',
    },
  ],
  evidence: [
    {
      id: 'evidence-1', projectId: 'proj-1', kind: 'source_excerpt',
      title: 'tests/checkout/empty-cart.spec.ts',
      uri: 'https://github.com/acme/ecommerce-app/blob/8f3c2a1d4e5f/tests/checkout/empty-cart.spec.ts',
      createdAt: '2026-06-16T10:45:00Z',
    },
    {
      id: 'evidence-2', projectId: 'proj-1', kind: 'source_excerpt',
      title: 'tests/checkout/cart-total.test.ts',
      uri: 'https://github.com/acme/ecommerce-app/blob/8f3c2a1d4e5f/tests/checkout/cart-total.test.ts',
      createdAt: '2026-06-16T10:45:00Z',
    },
    {
      id: 'evidence-3', projectId: 'proj-1', kind: 'source_excerpt',
      title: 'src/checkout/cart-service.ts',
      uri: 'https://github.com/acme/ecommerce-app/blob/8f3c2a1d4e5f/src/checkout/cart-service.ts',
      createdAt: '2026-06-16T10:45:00Z',
    },
    {
      id: 'evidence-4', projectId: 'proj-1', kind: 'source_excerpt',
      title: 'docs/checkout.md',
      uri: 'https://github.com/acme/ecommerce-app/blob/8f3c2a1d4e5f/docs/checkout.md',
      createdAt: '2026-06-16T10:45:00Z',
    },
  ],
}

async function renderPage(projectId = 'proj-1') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  await act(async () => {
    render(
      <QueryClientProvider client={client}>
        <ProjectRepositoryPage projectId={projectId} />
      </QueryClientProvider>,
    )
  })

  await waitFor(() => {
    expect(document.querySelector('[data-state-kind="loading"]')).toBeNull()
  })
}

describe('ProjectRepositoryPage', () => {
  beforeEach(() => {
    readRepository.mockResolvedValue(structuredClone(view))
  })

  afterEach(() => {
    act(() => {
      useI18nStore.setState({ locale: 'en' })
      __resetStore()
    })
    readRepository.mockReset()
  })

  it('renders the connected GitHub source in project context', async () => {
    await renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Repository' })).toBeInTheDocument()
    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('acme/ecommerce-app')).toBeInTheDocument()
    expect(screen.getByText('Pushes to this repository are ingested automatically.')).toBeInTheDocument()
    expect(readRepository).toHaveBeenCalledWith('proj-1', expect.anything())
  })

  it('presents the completed ingestion with inspectable evidence', async () => {
    await renderPage()

    expect(screen.getByRole('heading', { level: 2, name: 'Ingestion' })).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Webhook')).toBeInTheDocument()
    expect(screen.getByText('Jun 16, 2026, 10:45 AM')).toBeInTheDocument()
    expect(screen.getByText('PR #184')).toBeInTheDocument()
    expect(screen.getByText('8f3c2a1')).toBeInTheDocument()
    expect(screen.getAllByText('tests/checkout/empty-cart.spec.ts')).toHaveLength(2)
    expect(screen.getByText(/checkoutButton\)\.toBeDisabled/)).toBeInTheDocument()
    expect(
      screen.getAllByText('https://github.com/acme/ecommerce-app/blob/8f3c2a1d4e5f/tests/checkout/empty-cart.spec.ts'),
    ).toHaveLength(2)
  })

  it('presents only pattern-matched tests from the ingested batch', async () => {
    await renderPage()

    const detectedTests = screen.getByRole('region', { name: 'Detected tests' })
    expect(detectedTests).toHaveTextContent('tests/checkout/empty-cart.spec.ts')
    expect(detectedTests).toHaveTextContent('tests/checkout/cart-total.test.ts')
    expect(detectedTests).toHaveTextContent('*.spec.ts')
    expect(detectedTests).toHaveTextContent('*.test.ts')
    expect(detectedTests).not.toHaveTextContent('src/checkout/cart-service.ts')
    expect(detectedTests).not.toHaveTextContent('docs/checkout.md')
  })

  it('filters detected tests by pattern', async () => {
    const user = userEvent.setup()
    await renderPage()

    const detectedTests = screen.getByRole('region', { name: 'Detected tests' })
    await user.click(within(detectedTests).getByRole('button', { name: '*.test.ts' }))

    expect(detectedTests).toHaveTextContent('tests/checkout/cart-total.test.ts')
    expect(detectedTests).not.toHaveTextContent('tests/checkout/empty-cart.spec.ts')

    await user.click(within(detectedTests).getByRole('button', { name: '*.spec.ts' }))
    expect(detectedTests).toHaveTextContent('tests/checkout/empty-cart.spec.ts')
    expect(detectedTests).not.toHaveTextContent('tests/checkout/cart-total.test.ts')

    await user.click(within(detectedTests).getByRole('button', { name: 'All' }))
    expect(detectedTests).toHaveTextContent('tests/checkout/empty-cart.spec.ts')
    expect(detectedTests).toHaveTextContent('tests/checkout/cart-total.test.ts')
  })

  it('shows the origin evidence of every detected file, not only the first one', async () => {
    await renderPage()

    const detectedTests = screen.getByRole('region', { name: 'Detected tests' })
    const cartTotalItem = within(detectedTests).getByText('tests/checkout/cart-total.test.ts').closest('li')
    expect(cartTotalItem).not.toBeNull()
    expect(
      within(cartTotalItem!).getByText('https://github.com/acme/ecommerce-app/blob/8f3c2a1d4e5f/tests/checkout/cart-total.test.ts'),
    ).toBeInTheDocument()
  })

  it('shows an accessible error state when the ingestion batch failed, without a fabricated detection result', async () => {
    readRepository.mockResolvedValue({
      ...structuredClone(view),
      batch: { ...view.batch!, status: 'failed', codeChangeIds: [] },
      codeChanges: [],
      evidence: [],
    })

    await renderPage('proj-3')

    expect(screen.getByText('Failed')).toBeInTheDocument()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Extraction failed')
    expect(screen.queryByRole('region', { name: 'Detected tests' })).not.toBeInTheDocument()
  })

  it('translates ingestion labels in Spanish', async () => {
    await act(async () => {
      useI18nStore.setState({ locale: 'es' })
    })

    await renderPage()

    expect(screen.getByRole('heading', { level: 2, name: 'Ingesta' })).toBeInTheDocument()
    expect(screen.getByText('Completado')).toBeInTheDocument()
    expect(screen.getByText('Solicitud de extracción')).toBeInTheDocument()
    expect(screen.getByText('Confirmación')).toBeInTheDocument()
    expect(screen.getByText('Archivo')).toBeInTheDocument()
    expect(screen.getByText('Diferencia')).toBeInTheDocument()
    expect(screen.getByText('Origen')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Pruebas detectadas' })).toHaveTextContent('Patrón')
  })

  it('renders a localized no-source state without a fabricated connect action', async () => {
    readRepository.mockResolvedValue({ source: null, batch: null, codeChanges: [], evidence: [] })

    await act(async () => {
      useI18nStore.setState({ locale: 'es' })
    })

    await renderPage('proj-2')

    const description = screen.getByText('Este proyecto no tiene un repositorio de código configurado.')
    expect(description.closest('[data-state-kind]')).toHaveAttribute('data-state-kind', 'no-source')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('invites a first push when the connected repository has no batch yet', async () => {
    readRepository.mockResolvedValue({
      source: view.source,
      batch: null,
      codeChanges: [],
      evidence: [],
    })

    await renderPage()

    expect(screen.getByText('No ingested changes yet')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Ingestion' })).not.toBeInTheDocument()
  })

  it('surfaces an error state when the repository cannot be read', async () => {
    readRepository.mockRejectedValue(new Error('boom'))

    await renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent('Repository unavailable')
  })
})
