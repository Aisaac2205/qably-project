import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DocumentFilesResult } from '@qably/types'
import {
  DocumentWithAeris,
  useDocumentFiles,
  type DocumentFilesMode,
} from '@/features/projects/suites/components/document-with-aeris'
import { renderWithQuery } from '@/lib/query-test-utils'

function result(overrides: Partial<DocumentFilesResult> = {}): DocumentFilesResult {
  return { filesEnqueued: 2, casesTargeted: 7, casesSkipped: [], ...overrides }
}

function DocumentPanel({
  label = 'Document suite with Aeris',
  pendingCount,
  primaryMode,
  staleCount,
  onDocument,
  primary,
  activeMode,
}: {
  label?: string
  pendingCount: number
  primaryMode?: DocumentFilesMode
  staleCount?: number
  onDocument: (mode: DocumentFilesMode) => Promise<DocumentFilesResult>
  primary?: boolean
  activeMode?: DocumentFilesMode
}) {
  const documentation = useDocumentFiles(onDocument)
  return (
    <DocumentWithAeris
      label={label}
      pendingCount={pendingCount}
      primaryMode={primaryMode}
      staleCount={staleCount}
      documentation={documentation}
      primary={primary}
      activeMode={activeMode}
    />
  )
}

describe('DocumentWithAeris', () => {
  it('renders nothing when the scope has no documentable cases', () => {
    const { container } = renderWithQuery(
      <DocumentPanel pendingCount={0} onDocument={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('sends the undocumented mode from the primary action', async () => {
    const user = userEvent.setup()
    const onDocument = vi.fn().mockResolvedValue(result())

    renderWithQuery(<DocumentPanel pendingCount={7} onDocument={onDocument} />)
    await user.click(screen.getByRole('button', { name: /document \(7\)/i }))

    await waitFor(() => expect(onDocument.mock.calls[0]?.[0]).toBe('undocumented'))
    expect(onDocument).toHaveBeenCalledTimes(1)
  })

  it('shows the full label in a tooltip and keeps the visible text compact', async () => {
    const user = userEvent.setup()
    renderWithQuery(
      <DocumentPanel label="Document 7 cases with Aeris" pendingCount={7} onDocument={vi.fn()} />,
    )

    const trigger = screen.getByRole('button', { name: /document \(7\)/i })
    expect(trigger).not.toHaveTextContent('Document 7 cases with Aeris')
    await user.hover(trigger)
    expect(await screen.findByText('Document 7 cases with Aeris')).toBeInTheDocument()
  })

  it('sends the incomplete mode from the primary action when the primary mode is switched', async () => {
    const user = userEvent.setup()
    const onDocument = vi.fn().mockResolvedValue(result())

    renderWithQuery(
      <DocumentPanel pendingCount={3} primaryMode="incomplete" onDocument={onDocument} />,
    )
    await user.click(screen.getByRole('button', { name: /complete \(3\)/i }))

    await waitFor(() => expect(onDocument.mock.calls[0]?.[0]).toBe('incomplete'))
  })

  it('shows the complete label directly on the button, not only in the tooltip, once switched', () => {
    renderWithQuery(
      <DocumentPanel pendingCount={3} primaryMode="incomplete" onDocument={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: /complete \(3\)/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^document \(\d+\)$/i })).not.toBeInTheDocument()
  })

  it('carries no status copy of its own: the button is the whole surface', () => {
    const { container } = renderWithQuery(
      <DocumentPanel pendingCount={7} onDocument={vi.fn()} />,
    )

    expect(container.querySelectorAll('p')).toHaveLength(0)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('DocumentWithAeris pending feedback', () => {
  it('shows a spinner on the trigger that was clicked while the request is in flight', async () => {
    const user = userEvent.setup()
    const onDocument = vi.fn(() => new Promise<DocumentFilesResult>(() => {}))

    const { container } = renderWithQuery(
      <DocumentPanel pendingCount={5} onDocument={onDocument} />,
    )
    await user.click(screen.getByRole('button', { name: /document \(5\)/i }))

    await waitFor(() => {
      expect(container.querySelector('.spinner')).not.toBeNull()
    })
    expect(container.querySelector('.spinner')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('button', { name: /documenting/i })).toBeDisabled()
  })

  it('keeps the spinner and the disabled state while the watch still reports the mode as working', () => {
    const { container } = renderWithQuery(
      <DocumentPanel pendingCount={5} onDocument={vi.fn()} activeMode="undocumented" />,
    )

    expect(container.querySelector('.spinner')).not.toBeNull()
    expect(screen.getByRole('button', { name: /documenting/i })).toBeDisabled()
  })

  it('shows no spinner before the action is triggered', () => {
    const { container } = renderWithQuery(
      <DocumentPanel pendingCount={5} onDocument={vi.fn()} />,
    )

    expect(container.querySelector('.spinner')).toBeNull()
    expect(screen.getByRole('button', { name: /document \(5\)/i })).toBeEnabled()
  })
})

describe('DocumentWithAeris primary emphasis', () => {
  it('renders as a dashed secondary chip by default, beside a real primary action', () => {
    renderWithQuery(<DocumentPanel pendingCount={7} onDocument={vi.fn()} />)

    const button = screen.getByRole('button', { name: /document \(7\)/i })
    expect(button.className).toContain('border-dashed')
  })

  it('renders as the primary control when it is the only actionable item in the header', () => {
    renderWithQuery(<DocumentPanel pendingCount={7} onDocument={vi.fn()} primary />)

    const button = screen.getByRole('button', { name: /document \(7\)/i })
    expect(button.className).not.toContain('border-dashed')
    expect(button.className).toContain('font-semibold')
  })
})

describe('DocumentWithAeris stale locale', () => {
  it('offers to redocument outdated cases and sends the stale-locale mode', async () => {
    const user = userEvent.setup()
    const onDocument = vi.fn().mockResolvedValue(result())

    renderWithQuery(
      <DocumentPanel label="Document suite" pendingCount={0} staleCount={3} onDocument={onDocument} />,
    )
    await user.click(screen.getByRole('button', { name: /redocument 3 outdated/i }))

    await waitFor(() => expect(onDocument.mock.calls[0]?.[0]).toBe('stale-locale'))
    expect(screen.queryByRole('button', { name: /document \(\d+\)/i })).not.toBeInTheDocument()
  })

  it('renders both triggers when both modes apply', () => {
    renderWithQuery(
      <DocumentPanel label="Document suite" pendingCount={2} staleCount={3} onDocument={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: /document \(2\)/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /redocument 3 outdated/i })).toBeInTheDocument()
  })

  it('marks only the trigger whose mode is still working', () => {
    const { container } = renderWithQuery(
      <DocumentPanel
        label="Document suite"
        pendingCount={2}
        staleCount={3}
        onDocument={vi.fn()}
        activeMode="stale-locale"
      />,
    )

    expect(container.querySelectorAll('.spinner')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /document \(2\)/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /documenting/i })).toBeDisabled()
  })
})
