import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DocumentFilesResult } from '@qably/types'
import { DocumentWithAeris } from '@/features/projects/suites/components/document-with-aeris'
import { renderWithQuery } from '@/lib/query-test-utils'

function result(overrides: Partial<DocumentFilesResult> = {}): DocumentFilesResult {
  return { filesEnqueued: 2, casesTargeted: 7, casesSkipped: [], ...overrides }
}

describe('DocumentWithAeris', () => {
  it('renders nothing when the scope has no documentable cases', () => {
    const { container } = renderWithQuery(
      <DocumentWithAeris
        label="Document suite with Aeris"
        pendingCount={0}
        onDocument={vi.fn()}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('names how many cases are waiting so the cost is visible before the click', () => {
    renderWithQuery(
      <DocumentWithAeris
        label="Document suite with Aeris"
        pendingCount={7}
        onDocument={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', { name: /document suite with aeris/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/7 automated cases are not documented yet/i)).toBeInTheDocument()
  })

  it('reports the queued counts in a live region after a successful run', async () => {
    const user = userEvent.setup()
    const onDocument = vi.fn().mockResolvedValue(result())

    renderWithQuery(
      <DocumentWithAeris
        label="Document suite with Aeris"
        pendingCount={7}
        onDocument={onDocument}
      />,
    )
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
          { reason: 'already-pending', count: 1 },
        ],
      }),
    )

    renderWithQuery(
      <DocumentWithAeris
        label="Document suite with Aeris"
        pendingCount={7}
        onDocument={onDocument}
      />,
    )
    await user.click(screen.getByRole('button', { name: /document suite with aeris/i }))

    await waitFor(() => {
      expect(
        screen.getByText(/3 cases were skipped because they have no test file/i),
      ).toBeInTheDocument()
    })
    expect(
      screen.getByText(/1 cases already have a proposal waiting/i),
    ).toBeInTheDocument()
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

    renderWithQuery(
      <DocumentWithAeris
        label="Document suite with Aeris"
        pendingCount={4}
        onDocument={onDocument}
      />,
    )
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

    renderWithQuery(
      <DocumentWithAeris
        label="Document suite with Aeris"
        pendingCount={7}
        onDocument={onDocument}
      />,
    )
    await user.click(screen.getByRole('button', { name: /document suite with aeris/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/could not queue/i)
    })
  })
})

describe('DocumentWithAeris stale locale', () => {
  it('offers to redocument outdated cases and sends the stale-locale mode', async () => {
    const user = userEvent.setup()
    const onDocument = vi.fn().mockResolvedValue(result())

    renderWithQuery(
      <DocumentWithAeris
        label="Document suite"
        pendingCount={0}
        staleCount={3}
        onDocument={onDocument}
      />,
    )
    await user.click(screen.getByRole('button', { name: /redocument 3 outdated/i }))

    await waitFor(() => expect(onDocument.mock.calls[0]?.[0]).toBe('stale-locale'))
    expect(screen.queryByRole('button', { name: /^document suite$/i })).not.toBeInTheDocument()
  })

  it('sends the undocumented mode from the primary action', async () => {
    const user = userEvent.setup()
    const onDocument = vi.fn().mockResolvedValue(result())

    renderWithQuery(
      <DocumentWithAeris label="Document suite" pendingCount={2} onDocument={onDocument} />,
    )
    await user.click(screen.getByRole('button', { name: /document suite/i }))

    await waitFor(() => expect(onDocument.mock.calls[0]?.[0]).toBe('undocumented'))
  })
})
