import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { suiteKeys } from '@/features/projects/lib/query-keys'
import * as suitesApiStub from '@/test/suites-api-stub'
import { renderList } from './suite-list-harness'
import { rowIds } from './suite-list-results-pages'

vi.mock('@/features/projects/suites/api/suites.api', async () =>
  await import('@/test/suites-api-stub'),
)
vi.mock('@/features/runs/api/runs.api', async () =>
  await import('@/test/runs-api-stub'),
)

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

type User = ReturnType<typeof userEvent.setup>

async function tagOptions(user: User): Promise<HTMLElement[]> {
  await user.click(screen.getByRole('button', { name: 'Tag filter' }))

  return within(await screen.findByRole('listbox')).getAllByRole('option')
}

function namesOf(options: HTMLElement[]): string[] {
  return options.map((option) => option.textContent ?? '')
}

async function choose(options: HTMLElement[], name: string, user: User) {
  const option = options.find((candidate) => candidate.textContent === name)

  if (option === undefined) throw new Error(`no option named ${name}`)

  await user.click(option)
}

async function facetSettled(client: QueryClient, status: 'success' | 'error') {
  await waitFor(() => {
    expect(client.getQueryState(suiteKeys.tags('proj-1'))?.status).toBe(status)
  })
}

describe('SuiteList tag filter', () => {
  let listTags: MockInstance<typeof suitesApiStub.listSuiteTags>

  beforeEach(() => {
    suitesApiStub.__resetSuitesStub()
    listTags = vi.spyOn(suitesApiStub, 'listSuiteTags')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('the tags it offers', () => {
    it('are all those of the facet, also the ones only found on suites that are not loaded, after All tags', async () => {
      const user = userEvent.setup()
      listTags.mockResolvedValue({ items: ['only-on-a-later-page', 'smoke'] })
      const { client } = await renderList()
      await screen.findByTestId('suite-row-suite-4')
      await facetSettled(client, 'success')

      expect(namesOf(await tagOptions(user))).toEqual(['All tags', 'only-on-a-later-page', 'smoke'])
    })

    it('are the same in the sheet of the filters, which has its own tag selector', async () => {
      const user = userEvent.setup()
      listTags.mockResolvedValue({ items: ['only-on-a-later-page', 'smoke'] })
      const { client } = await renderList()
      await screen.findByTestId('suite-row-suite-4')
      await facetSettled(client, 'success')

      await user.click(screen.getByTestId('suite-filters-trigger'))
      const sheet = await screen.findByRole('dialog')
      const [, tagSelect] = within(sheet).getAllByRole('combobox')
      await user.click(tagSelect)

      const options = await screen.findAllByRole('option')
      expect(namesOf(options)).toEqual(['All tags', 'only-on-a-later-page', 'smoke'])
    })

    it('are only All tags while the facet loads, and the list does not wait for it', async () => {
      const user = userEvent.setup()
      listTags.mockReturnValue(new Promise(() => undefined))

      await renderList()

      await screen.findByTestId('suite-row-suite-4')
      expect(rowIds()).toHaveLength(4)
      expect(namesOf(await tagOptions(user))).toEqual(['All tags'])
    })

    it('are only All tags when the facet fails, and the list is still there', async () => {
      const user = userEvent.setup()
      listTags.mockRejectedValue(new Error('down'))

      const { client } = await renderList()

      await screen.findByTestId('suite-row-suite-4')
      await facetSettled(client, 'error')
      expect(rowIds()).toHaveLength(4)
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
      expect(namesOf(await tagOptions(user))).toEqual(['All tags'])
    })
  })

  describe('the active tag', () => {
    it('stays selectable, and shown as the selected one, when the facet no longer has it', async () => {
      const user = userEvent.setup()
      listTags.mockResolvedValue({ items: ['auth', 'smoke'] })
      const { client } = await renderList()
      await screen.findByTestId('suite-row-suite-4')
      await facetSettled(client, 'success')
      await choose(await tagOptions(user), 'smoke', user)

      await act(async () => {
        client.setQueryData(suiteKeys.tags('proj-1'), { items: ['auth'] })
      })

      expect(screen.getByRole('button', { name: 'Tag filter' })).toHaveTextContent('smoke')
      const options = await tagOptions(user)
      expect(namesOf(options)).toEqual(['All tags', 'auth', 'smoke'])
      expect(options.find((option) => option.textContent === 'smoke')).toHaveAttribute(
        'aria-selected',
        'true',
      )
    })

    it('leaves no trace once All tags is chosen again and the facet no longer has it', async () => {
      const user = userEvent.setup()
      listTags.mockResolvedValue({ items: ['auth', 'smoke'] })
      const { client } = await renderList()
      await screen.findByTestId('suite-row-suite-4')
      await facetSettled(client, 'success')
      await choose(await tagOptions(user), 'smoke', user)
      await act(async () => {
        client.setQueryData(suiteKeys.tags('proj-1'), { items: ['auth'] })
      })
      await choose(await tagOptions(user), 'All tags', user)

      expect(screen.getByRole('button', { name: 'Tag filter' })).toHaveTextContent('All tags')
      expect(namesOf(await tagOptions(user))).toEqual(['All tags', 'auth'])
    })
  })
})
