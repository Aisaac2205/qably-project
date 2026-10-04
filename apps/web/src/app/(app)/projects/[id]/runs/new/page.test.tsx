import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderWithQuery } from '@/lib/query-test-utils'
import NewRunPage from './page'

const navigation = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }))
const project = vi.hoisted(() => ({ hasManualCases: true as boolean | undefined }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navigation.replace, push: navigation.push }),
}))

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)
vi.mock('@/features/runs/api/runs.api', async () => await import('@/test/runs-api-stub'))
vi.mock('@/features/runs/api/ci-runs.api', () => ({
  listCiRuns: vi.fn(),
  getCiRun: vi.fn(),
}))
vi.mock('@/features/projects/hooks/use-project', () => ({
  useProject: () => ({
    project: { id: 'proj-1', name: 'Ecommerce App', hasManualCases: project.hasManualCases },
    isLoading: false,
    isError: false,
  }),
}))

type SearchParams = { suite?: string | string[] }

async function renderPage(searchParams: SearchParams = {}) {
  const element = await NewRunPage({
    params: Promise.resolve({ id: 'proj-1' }),
    searchParams: Promise.resolve(searchParams),
  })

  await act(async () => {
    renderWithQuery(element)
  })
}

function suiteSelect() {
  return screen.getByRole('combobox', { name: 'Suite' })
}

describe('the new run deep link page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    project.hasManualCases = true
  })

  it('opens the list on the Manual tab with the new run dialog open and the suite preselected', async () => {
    await renderPage({ suite: 'suite-2' })

    expect(await screen.findByRole('dialog', { name: 'New run' })).toBeInTheDocument()
    expect(suiteSelect()).toHaveTextContent('Checkout')
    expect(screen.getByRole('tab', { name: 'Manual', hidden: true })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('heading', { level: 1, hidden: true })).toHaveTextContent('Runs')
  })

  it('moves focus to the suite select when the dialog opens', async () => {
    await renderPage({ suite: 'suite-1' })

    await screen.findByRole('dialog', { name: 'New run' })
    await waitFor(() => {
      expect(suiteSelect()).toHaveFocus()
    })
  })

  it.each<[string, SearchParams]>([
    ['is absent', {}],
    ['is empty', { suite: '' }],
    ['is repeated', { suite: ['suite-1', 'suite-2'] }],
    ['names a suite that does not exist', { suite: 'suite-gone' }],
  ])('opens the dialog with no suite chosen when the suite %s', async (_label, searchParams) => {
    await renderPage(searchParams)

    expect(await screen.findByRole('dialog', { name: 'New run' })).toBeInTheDocument()
    expect(suiteSelect()).toHaveTextContent('Select a suite')
  })

  it('closes with Escape, keeps the list and gives focus back to the New run button', async () => {
    const user = userEvent.setup()
    await renderPage({ suite: 'suite-1' })
    await screen.findByRole('dialog', { name: 'New run' })

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(screen.getByRole('tab', { name: 'Manual' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: 'New run' })).toHaveFocus()
    expect(navigation.replace).not.toHaveBeenCalled()
  })

  it('leaves the deep link address when the user picks the other tab', async () => {
    const user = userEvent.setup()
    await renderPage({ suite: 'suite-1' })
    await screen.findByRole('dialog', { name: 'New run' })
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('tab', { name: 'Actions' }))

    expect(navigation.replace).toHaveBeenCalledWith('/projects/proj-1/runs?tab=actions', {
      scroll: false,
    })
  })

  it('does not open the dialog when the project has no manual cases', async () => {
    project.hasManualCases = false

    await renderPage({ suite: 'suite-1' })

    const button = await screen.findByRole('button', { name: 'New run' })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
