import type { ReactNode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, beforeEach, vi } from 'vitest'
import type { SuiteCollision } from '@qably/types'
import { useI18nStore } from '@/lib/i18n'
import { SuiteCollisionsPanel } from '@/features/projects/suites/components/suite-collisions-panel'
import { dismissCollision } from '@/features/projects/suites/api/suites.api'

vi.mock('@/features/projects/suites/api/suites.api', () => ({
  dismissCollision: vi.fn(),
}))

const dismissCollisionApi = vi.mocked(dismissCollision)

const legacyCollision: SuiteCollision = {
  id: 'collision-legacy',
  kind: 'legacy_key',
  key: 'test_create',
  claimantCount: 2,
  lastSeenAt: '2026-10-12T09:00:00.000Z',
  lastRunId: 'run-9',
}

const identityCollision: SuiteCollision = {
  id: 'collision-identity',
  kind: 'identity',
  key: 'tests.checkout::test_add_item',
  claimantCount: 3,
  lastSeenAt: '2026-10-11T09:00:00.000Z',
  lastRunId: null,
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

function renderPanel(openCollisions: number | undefined, collisions?: SuiteCollision[]) {
  return render(
    <SuiteCollisionsPanel
      projectId="project-1"
      suiteId="suite-1"
      openCollisions={openCollisions}
      collisions={collisions}
    />,
    { wrapper },
  )
}

describe('SuiteCollisionsPanel', () => {
  beforeEach(() => {
    useI18nStore.setState({ locale: 'en' })
    dismissCollisionApi.mockReset()
  })

  it('renders nothing when the suite has no open collisions', () => {
    const { container } = renderPanel(0, [])

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when openCollisions is undefined', () => {
    const { container } = renderPanel(undefined)

    expect(container).toBeEmptyDOMElement()
  })

  it('uses the singular plural key for exactly one open collision', () => {
    renderPanel(1, [legacyCollision])

    expect(
      screen.getByText('1 automation key matches more than one test case in this suite.'),
    ).toBeInTheDocument()
  })

  it('uses the plural key for more than one open collision', () => {
    renderPanel(3)

    expect(
      screen.getByText('3 automation keys match more than one test case in this suite.'),
    ).toBeInTheDocument()
  })

  it('surfaces the summary inside a status region so assistive tech announces it', () => {
    renderPanel(2, [legacyCollision, identityCollision])

    expect(screen.getByRole('status')).toHaveTextContent(
      '2 automation keys match more than one test case in this suite.',
    )
  })

  it('says how the collisions resolve, automatically or by hand', () => {
    renderPanel(1, [legacyCollision])

    expect(
      screen.getByText(
        'Resolved automatically when a later run no longer reports the ambiguity, or dismissed by hand once the tests were renamed or deleted.',
      ),
    ).toBeInTheDocument()
  })

  it('lists each open key with a plain explanation of its kind', () => {
    renderPanel(2, [legacyCollision, identityCollision])

    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('test_create')
    expect(items[0]).toHaveTextContent(
      'An older case is keyed by this bare test name, and several test classes report it.',
    )
    expect(items[1]).toHaveTextContent('tests.checkout::test_add_item')
    expect(items[1]).toHaveTextContent('Two tests in the same report resolve to this key.')
  })

  it('links a key to the run that last reported it, when there is one', () => {
    renderPanel(2, [legacyCollision, identityCollision])

    const [legacyItem, identityItem] = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(within(legacyItem).getByRole('link', { name: /last run/i })).toHaveAttribute(
      'href',
      '/projects/project-1/runs/run-9',
    )
    expect(within(identityItem).queryByRole('link')).not.toBeInTheDocument()
  })

  it('names the key in each dismiss button and explains that it can come back', () => {
    renderPanel(1, [legacyCollision])

    const button = screen.getByRole('button', { name: 'Dismiss test_create' })
    expect(button).toHaveAccessibleDescription(
      'It reappears if a later run still reports this collision.',
    )
  })

  it('dismisses the key of the suite when its button is pressed', async () => {
    dismissCollisionApi.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderPanel(1, [legacyCollision])

    await user.click(screen.getByRole('button', { name: 'Dismiss test_create' }))

    await waitFor(() => {
      expect(dismissCollisionApi).toHaveBeenCalledWith('suite-1', 'collision-legacy')
    })
  })
})
