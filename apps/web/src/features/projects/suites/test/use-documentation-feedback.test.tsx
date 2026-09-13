import { screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentFilesResult } from '@qably/types'
import { notify } from '@/lib/notify'
import { useDocumentFiles } from '@/features/projects/suites/components/document-with-aeris'
import { useDocumentationFeedback } from '@/features/projects/suites/hooks/use-documentation-feedback'
import type { DocumentationWatchStatus } from '@/features/projects/suites/lib/documentation-watch'
import { renderWithQuery } from '@/lib/query-test-utils'

vi.mock('@/lib/notify', () => ({
  notify: {
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  },
}))

function result(overrides: Partial<DocumentFilesResult> = {}): DocumentFilesResult {
  return { filesEnqueued: 2, casesTargeted: 7, casesSkipped: [], ...overrides }
}

function Harness({
  onDocument,
  watchStatus = 'idle',
  documentedCount = 0,
}: {
  onDocument: () => Promise<DocumentFilesResult>
  watchStatus?: DocumentationWatchStatus
  documentedCount?: number
}) {
  const [renders, setRenders] = useState(0)
  const documentation = useDocumentFiles(onDocument)
  useDocumentationFeedback({ documentation, watchStatus, documentedCount })
  return (
    <>
      <button type="button" onClick={() => documentation.mutate('undocumented')}>
        go
      </button>
      <button type="button" onClick={() => setRenders((n) => n + 1)}>
        rerender {renders}
      </button>
    </>
  )
}

describe('useDocumentationFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('announces what was queued, with every skip reason as the description', async () => {
    const user = userEvent.setup()
    const onDocument = vi.fn().mockResolvedValue(
      result({
        casesSkipped: [
          { reason: 'no-automation-key', count: 3 },
          { reason: 'already-pending', count: 1 },
        ],
      }),
    )

    renderWithQuery(<Harness onDocument={onDocument} />)
    await user.click(screen.getByRole('button', { name: 'go' }))

    await waitFor(() => {
      expect(notify.info).toHaveBeenCalledWith(
        'Aeris is documenting 7 cases across 2 files.',
        {
          description:
            '3 cases were skipped because they are not linked to any automated test. 1 case already has a proposal waiting in the review inbox.',
        },
      )
    })
    expect(notify.info).toHaveBeenCalledTimes(1)
  })

  it('says nothing was queued when every case was skipped, without inventing a description', async () => {
    const user = userEvent.setup()
    const onDocument = vi.fn().mockResolvedValue(result({ filesEnqueued: 0, casesTargeted: 0 }))

    renderWithQuery(<Harness onDocument={onDocument} />)
    await user.click(screen.getByRole('button', { name: 'go' }))

    await waitFor(() => {
      expect(notify.info).toHaveBeenCalledWith(
        'There are no automated cases left to document.',
        undefined,
      )
    })
  })

  it('keeps a failure on screen through notify.error', async () => {
    const user = userEvent.setup()
    const onDocument = vi.fn().mockRejectedValue(new Error('boom'))

    renderWithQuery(<Harness onDocument={onDocument} />)
    await user.click(screen.getByRole('button', { name: 'go' }))

    await waitFor(() => {
      expect(notify.error).toHaveBeenCalledWith('Could not queue this documentation. Try again.')
    })
    expect(notify.info).not.toHaveBeenCalled()
  })

  it('celebrates the settled count once, not on every render', async () => {
    const user = userEvent.setup()
    renderWithQuery(<Harness onDocument={vi.fn()} watchStatus="settled" documentedCount={12} />)

    await waitFor(() => {
      expect(notify.success).toHaveBeenCalledWith('Aeris documented 12 cases in this suite.')
    })
    await user.click(screen.getByRole('button', { name: /rerender/i }))

    expect(screen.getByRole('button', { name: /rerender 1/i })).toBeInTheDocument()
    expect(notify.success).toHaveBeenCalledTimes(1)
  })

  it('admits it stopped watching when the window elapses', async () => {
    renderWithQuery(<Harness onDocument={vi.fn()} watchStatus="timed-out" />)

    await waitFor(() => {
      expect(notify.warning).toHaveBeenCalledWith(expect.stringMatching(/taking longer than usual/i))
    })
  })

  it('stays quiet while the watch is merely working: the spinner already says so', () => {
    renderWithQuery(<Harness onDocument={vi.fn()} watchStatus="working" />)

    expect(notify.info).not.toHaveBeenCalled()
    expect(notify.success).not.toHaveBeenCalled()
    expect(notify.warning).not.toHaveBeenCalled()
  })
})
