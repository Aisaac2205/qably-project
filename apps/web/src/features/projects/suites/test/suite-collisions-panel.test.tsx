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
  claimants: ['tests.ClassA::test_create', 'tests.ClassB::test_create'],
  lastSeenAt: '2026-10-12T09:00:00.000Z',
  lastRunId: 'run-9',
}

const identityCollision: SuiteCollision = {
  id: 'collision-identity',
  kind: 'identity',
  key: 'tests.checkout::test_add_item',
  claimantCount: 3,
  claimants: [
    'tests.checkout::test_add_item',
    'tests.checkout › test_add_item',
    'tests.checkout.cart › test_add_item',
  ],
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

function itemsOf(list: HTMLElement) {
  return within(list).getAllByRole('listitem')
}

/** The collisions themselves: the direct items of the outer list, not the tests nested in them. */
function collisionItems(): HTMLElement[] {
  return Array.from(screen.getAllByRole('list')[0].children) as HTMLElement[]
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

  it('says how many tests of the last report could not be linked to a case', () => {
    renderPanel(2, [legacyCollision, identityCollision])

    expect(
      screen.getByRole('heading', {
        name: '5 tests from the last report could not be linked to a case',
      }),
    ).toBeInTheDocument()
  })

  it('does not guess a number when the list of collisions is missing', () => {
    renderPanel(3)

    expect(
      screen.getByRole('heading', {
        name: 'Some tests from the last report could not be linked to a case',
      }),
    ).toBeInTheDocument()
  })

  it('states the consequence and the fix in the status region so assistive tech announces them', () => {
    renderPanel(2, [legacyCollision, identityCollision])

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('5 tests from the last report could not be linked to a case')
    expect(status).toHaveTextContent(
      'Their results are not counted on any case while they share a name.',
    )
    expect(status).toHaveTextContent(
      'Rename the tests in your code so each one has a unique name.',
    )
  })

  it('says the warning closes by itself', () => {
    renderPanel(1, [legacyCollision])

    expect(
      screen.getByText(
        'This closes by itself on the next report that no longer repeats these names.',
      ),
    ).toBeInTheDocument()
  })

  it('speaks in plain QA language, with no automation-key or identity jargon', () => {
    const { container } = renderPanel(2, [legacyCollision, identityCollision])

    expect(container).not.toHaveTextContent(/automation key|identity/i)
  })

  it('lists the tests that share each name, in full, one per line', () => {
    renderPanel(2, [legacyCollision, identityCollision])

    const [legacyItem, identityItem] = collisionItems()
    const legacyTests = itemsOf(within(legacyItem).getByRole('list'))
    const identityTests = itemsOf(within(identityItem).getByRole('list'))

    expect(legacyTests.map((item) => item.textContent)).toEqual([
      'tests.ClassA::test_create',
      'tests.ClassB::test_create',
    ])
    expect(identityTests.map((item) => item.textContent)).toEqual(identityCollision.claimants)
  })

  it('names each list of tests for assistive tech', () => {
    renderPanel(1, [legacyCollision])

    expect(screen.getByRole('list', { name: 'Tests that share this name' })).toBeInTheDocument()
  })

  it('shows a long test name whole instead of cutting it', () => {
    const longName = `SuiteListQueryService.page bounded reads reads the suites once, the case counts once and the run windows once for sort createdAt and status all with ${'1'.repeat(200)} suites`
    renderPanel(1, [{ ...identityCollision, claimants: [longName, 'another'], claimantCount: 2 }])

    expect(screen.getByText(longName)).toBeInTheDocument()
  })

  it('says how many more tests share the name than the ones listed', () => {
    renderPanel(1, [{ ...identityCollision, claimantCount: 14 }])

    expect(screen.getByText('and 11 more')).toBeInTheDocument()
  })

  it('does not claim extra tests when every claimant is listed', () => {
    renderPanel(1, [identityCollision])

    expect(screen.queryByText(/and \d+ more/)).not.toBeInTheDocument()
  })

  it('falls back to the key itself when no claimants were stored for the row', () => {
    renderPanel(1, [{ ...identityCollision, claimants: [] }])

    const [item] = collisionItems()
    expect(itemsOf(within(item).getByRole('list')).map((entry) => entry.textContent)).toEqual([
      'tests.checkout::test_add_item',
    ])
    expect(screen.queryByText(/and \d+ more/)).not.toBeInTheDocument()
  })

  it('explains each kind of collision in terms of what the person loses', () => {
    renderPanel(2, [legacyCollision, identityCollision])

    const [legacyItem, identityItem] = collisionItems()
    expect(legacyItem).toHaveTextContent(
      'An older case is keyed only by the method name, which several classes report, so none claims it and that case receives no results:',
    )
    expect(identityItem).toHaveTextContent(
      'These tests resolve to the same name, so Qably cannot tell which case each result belongs to:',
    )
  })

  it('links a collision to the run that last reported it, when there is one', () => {
    renderPanel(2, [legacyCollision, identityCollision])

    const [legacyItem, identityItem] = collisionItems()
    expect(within(legacyItem).getByRole('link', { name: /last run/i })).toHaveAttribute(
      'href',
      '/projects/project-1/runs/run-9',
    )
    expect(within(identityItem).queryByRole('link')).not.toBeInTheDocument()
  })

  it('keeps dismissing as a quiet action that names the key and says it can come back', () => {
    renderPanel(1, [legacyCollision])

    const button = screen.getByRole('button', { name: 'Dismiss the warning for test_create' })
    expect(button).toHaveAccessibleDescription(
      'It reappears if a later report still repeats these names.',
    )
  })

  it('dismisses the collision of the suite when its button is pressed', async () => {
    dismissCollisionApi.mockResolvedValueOnce(undefined)
    const user = userEvent.setup()
    renderPanel(1, [legacyCollision])

    await user.click(screen.getByRole('button', { name: 'Dismiss the warning for test_create' }))

    await waitFor(() => {
      expect(dismissCollisionApi).toHaveBeenCalledWith('suite-1', 'collision-legacy')
    })
  })

  it('speaks Spanish when the locale is Spanish', () => {
    useI18nStore.setState({ locale: 'es' })
    renderPanel(1, [identityCollision])

    expect(
      screen.getByRole('heading', {
        name: '3 pruebas del último reporte no se pudieron vincular a un caso',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Sus resultados no cuentan en ningún caso mientras compartan nombre.',
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Renombre las pruebas en el código para que cada una tenga un nombre único.',
    )
  })
})
