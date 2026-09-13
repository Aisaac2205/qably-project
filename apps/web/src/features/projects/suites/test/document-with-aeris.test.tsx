import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DocumentFilesResult } from '@qably/types'
import {
  DocumentWithAeris,
  DocumentFilesStatus,
  useDocumentFiles,
  type DocumentFilesMode,
} from '@/features/projects/suites/components/document-with-aeris'
import { renderWithQuery } from '@/lib/query-test-utils'
import type { DocumentationWatchStatus } from '@/features/projects/suites/lib/documentation-watch'

function result(overrides: Partial<DocumentFilesResult> = {}): DocumentFilesResult {
  return { filesEnqueued: 2, casesTargeted: 7, casesSkipped: [], ...overrides }
}

function DocumentPanel({
  label = 'Document suite with Aeris',
  pendingCount,
  staleCount,
  onDocument,
  primary,
  watchStatus = 'idle',
  documentedCount = 0,
}: {
  label?: string
  pendingCount: number
  staleCount?: number
  onDocument: (mode: DocumentFilesMode) => Promise<DocumentFilesResult>
  primary?: boolean
  watchStatus?: DocumentationWatchStatus
  documentedCount?: number
}) {
  const documentation = useDocumentFiles(onDocument)
  return (
    <>
      <DocumentWithAeris
        label={label}
        pendingCount={pendingCount}
        staleCount={staleCount}
        documentation={documentation}
        primary={primary}
      />
      <DocumentFilesStatus
        documentation={documentation}
        pendingCount={pendingCount}
        watchStatus={watchStatus}
        documentedCount={documentedCount}
      />
    </>
  )
}

describe('DocumentFilesStatus while a run is outstanding', () => {
  it('says Aeris is still working instead of claiming the queue accepted means done', () => {
    renderWithQuery(
      <DocumentPanel pendingCount={7} onDocument={vi.fn()} watchStatus="working" />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(/aeris is documenting this suite/i)
  })

  it('reports the real number of cases documented once the counts settle', () => {
    renderWithQuery(
      <DocumentPanel
        pendingCount={2}
        onDocument={vi.fn()}
        watchStatus="settled"
        documentedCount={12}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      /aeris documented 12 cases in this suite/i,
    )
  })

  it('admits it stopped watching rather than reporting a failure it never observed', () => {
    renderWithQuery(
      <DocumentPanel pendingCount={7} onDocument={vi.fn()} watchStatus="timed-out" />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      /aeris is taking longer than usual/i,
    )
  })
})

describe('DocumentWithAeris + DocumentFilesStatus', () => {
  it('renders nothing when the scope has no documentable cases', () => {
    const { container } = renderWithQuery(
      <DocumentPanel pendingCount={0} onDocument={vi.fn()} />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('names how many cases are waiting so the cost is visible before the click', () => {
    renderWithQuery(<DocumentPanel pendingCount={7} onDocument={vi.fn()} />)

    expect(
      screen.getByRole('button', { name: /document suite with aeris/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/7 automated cases are not documented yet/i)).toBeInTheDocument()
  })

  it('reports the queued counts in a live region after a successful run', async () => {
    const user = userEvent.setup()
    const onDocument = vi.fn().mockResolvedValue(result())

    renderWithQuery(<DocumentPanel pendingCount={7} onDocument={onDocument} />)
    await user.click(screen.getByRole('button', { name: /document suite with aeris/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /documenting 7 cases across 2 files/i,
      )
    })
    expect(onDocument).toHaveBeenCalledTimes(1)
  })

  it('explains why cases were skipped instead of dropping them silently', async () => {
    const user = userEvent.setup()
    const onDocument = vi.fn().mockResolvedValue(
      result({
        casesSkipped: [
          { reason: 'no-source-file', count: 3 },
          { reason: 'already-pending', count: 2 },
        ],
      }),
    )

    renderWithQuery(<DocumentPanel pendingCount={7} onDocument={onDocument} />)
    await user.click(screen.getByRole('button', { name: /document suite with aeris/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/3 cases were skipped because they have no test file/i),
      ).toBeInTheDocument()
    })
    expect(
      screen.getByText(/2 cases already have a proposal waiting/i),
    ).toBeInTheDocument()
  })

  it('tells the user a person already documented the case rather than blaming the repository', async () => {
    const user = userEvent.setup()
    const onDocument = vi.fn().mockResolvedValue(
      result({
        casesSkipped: [{ reason: 'human-documented', count: 2 }],
      }),
    )

    renderWithQuery(<DocumentPanel pendingCount={7} onDocument={onDocument} />)
    await user.click(screen.getByRole('button', { name: /document suite with aeris/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/2 cases were documented by a person/i),
      ).toBeInTheDocument()
    })
  })

  it('counts in the singular when a single case is involved', async () => {
    const user = userEvent.setup()
    const onDocument = vi.fn().mockResolvedValue(
      result({
        casesSkipped: [{ reason: 'already-pending', count: 1 }],
      }),
    )

    renderWithQuery(<DocumentPanel pendingCount={1} onDocument={onDocument} />)

    expect(screen.getByText(/1 automated case is not documented yet/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /document suite with aeris/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/1 case already has a proposal waiting/i),
      ).toBeInTheDocument()
    })
  })

  it('says nothing was queued when every case was skipped', async () => {
    const user = userEvent.setup()
    const onDocument = vi.fn().mockResolvedValue(
      result({
        filesEnqueued: 0,
        casesTargeted: 0,
        casesSkipped: [{ reason: 'already-pending', count: 4 }],
      }),
    )

    renderWithQuery(<DocumentPanel pendingCount={4} onDocument={onDocument} />)
    await user.click(screen.getByRole('button', { name: /document suite with aeris/i }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /no automated cases left to document/i,
      )
    })
  })

  it('surfaces a failure instead of leaving the button looking successful', async () => {
    const user = userEvent.setup()
    const onDocument = vi.fn().mockRejectedValue(new Error('boom'))

    renderWithQuery(<DocumentPanel pendingCount={7} onDocument={onDocument} />)
    await user.click(screen.getByRole('button', { name: /document suite with aeris/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/could not queue/i)
    })
  })
})

describe('DocumentWithAeris primary emphasis', () => {
  it('renders as a dashed secondary chip by default, beside a real primary action', () => {
    renderWithQuery(<DocumentPanel pendingCount={7} onDocument={vi.fn()} />)

    const button = screen.getByRole('button', { name: /document suite with aeris/i })
    expect(button.className).toContain('border-dashed')
  })

  it('renders as the primary control when it is the only actionable item in the header', () => {
    renderWithQuery(<DocumentPanel pendingCount={7} onDocument={vi.fn()} primary />)

    const button = screen.getByRole('button', { name: /document suite with aeris/i })
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
    expect(screen.queryByRole('button', { name: /^document suite$/i })).not.toBeInTheDocument()
  })

  it('sends the undocumented mode from the primary action', async () => {
    const user = userEvent.setup()
    const onDocument = vi.fn().mockResolvedValue(result())

    renderWithQuery(<DocumentPanel label="Document suite" pendingCount={2} onDocument={onDocument} />)
    await user.click(screen.getByRole('button', { name: /document suite/i }))

    await waitFor(() => expect(onDocument.mock.calls[0]?.[0]).toBe('undocumented'))
  })

  it('renders both triggers without a wrapper around a single button when both modes apply', () => {
    renderWithQuery(
      <DocumentPanel label="Document suite" pendingCount={2} staleCount={3} onDocument={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: /^document suite$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /redocument 3 outdated/i })).toBeInTheDocument()
  })
})

describe('DocumentFilesStatus', () => {
  it('renders nothing on its own when there is no pending count and no mutation activity', () => {
    const { container } = renderWithQuery(<DocumentPanel pendingCount={0} onDocument={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
