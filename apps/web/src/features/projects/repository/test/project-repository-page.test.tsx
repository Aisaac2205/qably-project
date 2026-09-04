import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ProjectRepositoryView } from '@qably/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useI18nStore } from '@/lib/i18n'
import { __resetStore } from '@/lib/mock-store'
import { getProjectRepository, rotateWebhookSecret } from '../api/repository.api'
import { ProjectRepositoryPage } from '../components/project-repository-page'

vi.mock('../api/repository.api', () => ({
  getProjectRepository: vi.fn(),
  rotateWebhookSecret: vi.fn(),
}))

const readRepository = vi.mocked(getProjectRepository)
const rotateSecret = vi.mocked(rotateWebhookSecret)

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
      id: 'change-1', projectId: 'proj-1', commitSha: '8f3c2a1d4e5f',
      filePath: 'tests/checkout/empty-cart.spec.ts',
      diff: '', detectedPattern: '*.spec.ts', evidenceId: 'evidence-1',
    },
    {
      id: 'change-2', projectId: 'proj-1', commitSha: '8f3c2a1d4e5f',
      filePath: 'tests/checkout/cart-total.test.ts',
      diff: '', detectedPattern: '*.test.ts', evidenceId: 'evidence-2',
    },
    {
      id: 'change-3', projectId: 'proj-1', commitSha: '8f3c2a1d4e5f',
      filePath: 'src/checkout/cart-service.ts', diff: '', evidenceId: 'evidence-3',
    },
    {
      id: 'change-4', projectId: 'proj-1', commitSha: '8f3c2a1d4e5f',
      filePath: 'docs/checkout.md', diff: '', evidenceId: 'evidence-4',
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

const docsOnlyView: ProjectRepositoryView = {
  ...view,
  batch: { ...view.batch!, codeChangeIds: ['change-4'] },
  codeChanges: [view.codeChanges[3]],
  evidence: [view.evidence[3]],
}

function localTimestamp(iso: string, locale: 'en' | 'es') {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
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
    rotateSecret.mockResolvedValue({ webhookSecret: 'f'.repeat(64) })
  })

  afterEach(() => {
    act(() => {
      useI18nStore.setState({ locale: 'en' })
      __resetStore()
    })
    readRepository.mockReset()
    rotateSecret.mockReset()
  })

  it('renders the connected GitHub source in project context', async () => {
    await renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Repository' })).toBeInTheDocument()
    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('acme/ecommerce-app')).toBeInTheDocument()
    expect(screen.getByText('Pushes to this repository are ingested automatically.')).toBeInTheDocument()
    expect(readRepository).toHaveBeenCalledWith('proj-1', expect.anything())
  })

  it('formats the ingestion timestamp in the local zone instead of forcing UTC', async () => {
    const OriginalFormat = Intl.DateTimeFormat
    const spy = vi
      .spyOn(Intl, 'DateTimeFormat')
      .mockImplementation(function (locales?: unknown, options?: unknown) {
        return new (OriginalFormat as unknown as new (
          locales?: unknown,
          options?: unknown,
        ) => Intl.DateTimeFormat)(locales, options)
      } as never)

    await renderPage()

    const usedUtc = spy.mock.calls.some(
      ([, options]) => (options as Intl.DateTimeFormatOptions | undefined)?.timeZone === 'UTC',
    )
    spy.mockRestore()

    expect(usedUtc).toBe(false)
    expect(screen.getByText(localTimestamp('2026-06-16T10:45:00Z', 'en'))).toBeInTheDocument()
  })

  it('presents the ingestion metadata with the commit that produced it', async () => {
    await renderPage()

    expect(screen.getByRole('heading', { level: 2, name: 'Ingestion' })).toBeInTheDocument()
    expect(screen.getByText('Completed')).toBeInTheDocument()
    expect(screen.getByText('Webhook')).toBeInTheDocument()
    expect(screen.getByText('8f3c2a1')).toBeInTheDocument()
  })

  it('never renders a diff row or a pull request number the webhook does not provide', async () => {
    await renderPage()

    expect(screen.queryByText('Diff')).not.toBeInTheDocument()
    expect(screen.queryByText(/PR #/)).not.toBeInTheDocument()
    expect(screen.queryByText('undefined')).not.toBeInTheDocument()
  })

  it('lists every changed file in the batch, not only the first one', async () => {
    await renderPage()

    const files = screen.getByRole('region', { name: 'Changed files' })
    expect(within(files).getAllByRole('listitem')).toHaveLength(4)
    expect(files).toHaveTextContent('tests/checkout/empty-cart.spec.ts')
    expect(files).toHaveTextContent('tests/checkout/cart-total.test.ts')
    expect(files).toHaveTextContent('src/checkout/cart-service.ts')
    expect(files).toHaveTextContent('docs/checkout.md')
  })

  it('marks which changed files matched a declared test pattern', async () => {
    await renderPage()

    const files = screen.getByRole('region', { name: 'Changed files' })
    const specItem = within(files).getByText('tests/checkout/empty-cart.spec.ts').closest('li')
    const docsItem = within(files).getByText('docs/checkout.md').closest('li')

    expect(within(specItem!).getByText('*.spec.ts')).toBeInTheDocument()
    expect(within(docsItem!).queryByText(/\*\./)).not.toBeInTheDocument()
    expect(files).toHaveTextContent('4 files')
    expect(files).toHaveTextContent('2 detected tests')
  })

  it('opens each changed file at its origin instead of printing a raw URL', async () => {
    await renderPage()

    const files = screen.getByRole('region', { name: 'Changed files' })
    const cartTotalItem = within(files).getByText('tests/checkout/cart-total.test.ts').closest('li')
    const link = within(cartTotalItem!).getByRole('link')

    expect(link).toHaveAttribute(
      'href',
      'https://github.com/acme/ecommerce-app/blob/8f3c2a1d4e5f/tests/checkout/cart-total.test.ts',
    )
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('filters changed files by declared pattern', async () => {
    const user = userEvent.setup()
    await renderPage()

    const files = screen.getByRole('region', { name: 'Changed files' })
    await user.click(within(files).getByRole('button', { name: '*.test.ts' }))

    expect(files).toHaveTextContent('tests/checkout/cart-total.test.ts')
    expect(files).not.toHaveTextContent('tests/checkout/empty-cart.spec.ts')
    expect(files).not.toHaveTextContent('docs/checkout.md')

    await user.click(within(files).getByRole('button', { name: 'All' }))
    expect(files).toHaveTextContent('docs/checkout.md')
  })

  it('explains why no tests were detected instead of showing an empty list', async () => {
    readRepository.mockResolvedValue(structuredClone(docsOnlyView))

    await renderPage()

    const files = screen.getByRole('region', { name: 'Changed files' })
    expect(files).toHaveTextContent('This change did not touch any test file')
    expect(files).toHaveTextContent('*.spec.ts')
    expect(files).toHaveTextContent('*.test.ts')
    expect(within(files).queryByRole('button', { name: '*.spec.ts' })).not.toBeInTheDocument()
    expect(within(files).queryByRole('button', { name: 'All' })).not.toBeInTheDocument()
    expect(files).toHaveTextContent('docs/checkout.md')
  })

  it('uses the logo of the connected provider rather than a hardcoded one', async () => {
    readRepository.mockResolvedValue({
      ...structuredClone(view),
      source: { ...view.source!, provider: 'BITBUCKET', repo: 'acme/api' },
    })

    await renderPage()

    expect(screen.getByText('Bitbucket')).toBeInTheDocument()
    const logo = document.querySelector('img[src*="bitbucket"]')
    expect(logo).not.toBeNull()
    expect(document.querySelector('img[src*="github"]')).toBeNull()
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
    expect(screen.queryByRole('region', { name: 'Changed files' })).not.toBeInTheDocument()
  })

  it('translates ingestion labels in Spanish', async () => {
    await act(async () => {
      useI18nStore.setState({ locale: 'es' })
    })

    await renderPage()

    expect(screen.getByRole('heading', { level: 2, name: 'Ingesta' })).toBeInTheDocument()
    expect(screen.getByText('Completado')).toBeInTheDocument()
    expect(screen.getByText('Confirmación')).toBeInTheDocument()
    expect(screen.queryByText('Diferencia')).not.toBeInTheDocument()
    expect(screen.queryByText('Solicitud de extracción')).not.toBeInTheDocument()
    const archivos = screen.getByRole('region', { name: 'Archivos del cambio' })
    expect(within(archivos).getByRole('group', { name: 'Patrón' })).toBeInTheDocument()
    expect(archivos).toHaveTextContent('4 archivos · 2 pruebas detectadas')
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

  it('states the setup requirement instead of asserting a push is enough when no batch exists yet', async () => {
    readRepository.mockResolvedValue({
      source: view.source,
      batch: null,
      codeChanges: [],
      evidence: [],
    })

    await renderPage()

    expect(screen.getByText('No ingested changes yet')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Ingestion' })).not.toBeInTheDocument()
    expect(screen.queryByText(/^Push to this repository/)).not.toBeInTheDocument()
    expect(screen.getByText(/Confirm that the webhook is configured/)).toBeInTheDocument()
  })

  it('links the empty state to the webhook setup panel with the payload URL and steps', async () => {
    const user = userEvent.setup()
    readRepository.mockResolvedValue({
      source: view.source,
      batch: null,
      codeChanges: [],
      evidence: [],
    })

    await renderPage()

    await user.click(screen.getByRole('button', { name: 'View webhook setup' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/webhooks\/scm\/github/)).toBeInTheDocument()
    expect(within(dialog).getByText('application/json')).toBeInTheDocument()
    expect(within(dialog).getByRole('list').tagName).toBe('OL')
  })

  it('surfaces an error state when the repository cannot be read', async () => {
    readRepository.mockRejectedValue(new Error('boom'))

    await renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent('Repository unavailable')
  })

  it('offers rotating the webhook secret from the connected source card', async () => {
    await renderPage()

    expect(screen.getByRole('button', { name: 'Rotate secret' })).toBeInTheDocument()
    expect(rotateSecret).not.toHaveBeenCalled()
  })

  it('warns before rotating and reveals the new secret once confirmed', async () => {
    const user = userEvent.setup()
    await renderPage()

    await user.click(screen.getByRole('button', { name: 'Rotate secret' }))

    const confirm = await screen.findByRole('alertdialog').catch(() => screen.getByRole('dialog'))
    expect(within(confirm).getByText(/stops being valid immediately/i)).toBeInTheDocument()

    await user.click(within(confirm).getByRole('button', { name: 'Rotate secret' }))

    await waitFor(() => {
      expect(rotateSecret).toHaveBeenCalledWith('proj-1')
    })
    expect(await screen.findByText('f'.repeat(64))).toBeInTheDocument()
  })

  it('reports a rotation that fails without revealing a secret', async () => {
    const user = userEvent.setup()
    rotateSecret.mockRejectedValue(new Error('nope'))
    await renderPage()

    await user.click(screen.getByRole('button', { name: 'Rotate secret' }))
    const confirm = await screen.findByRole('alertdialog').catch(() => screen.getByRole('dialog'))
    await user.click(within(confirm).getByRole('button', { name: 'Rotate secret' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The secret could not be rotated. Try again.',
    )
    expect(screen.queryByText('f'.repeat(64))).not.toBeInTheDocument()
  })
})
