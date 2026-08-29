import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RepoPicker } from './repo-picker'

const options = [
  { value: 'conn-1', repo: 'Aisaac2205/vaultly-dumps', isPrivate: true },
  { value: 'repo:Aisaac2205/mps-ecomerce', repo: 'Aisaac2205/mps-ecomerce', isPrivate: false },
  { value: 'repo:Aisaac2205/qably-project', repo: 'Aisaac2205/qably-project', isPrivate: true },
]

function renderPicker(overrides: Partial<Parameters<typeof RepoPicker>[0]> = {}) {
  const onChange = vi.fn()
  const onRefresh = vi.fn()
  render(
    <RepoPicker
      options={options}
      value=""
      onChange={onChange}
      onRefresh={onRefresh}
      isLoading={false}
      {...overrides}
    />,
  )
  return { onChange, onRefresh }
}

describe('RepoPicker', () => {
  it('offers every repository as a selectable radio so arrow keys work', () => {
    renderPicker()

    expect(screen.getAllByRole('radio')).toHaveLength(3)
  })

  it('names the group so a screen reader announces what is being chosen', () => {
    renderPicker()

    expect(
      screen.getByRole('radiogroup', { name: /repository/i }),
    ).toBeInTheDocument()
  })

  it('reports the selected repository to the caller', async () => {
    const user = userEvent.setup()
    const { onChange } = renderPicker()

    await user.click(screen.getByRole('radio', { name: /mps-ecomerce/ }))

    expect(onChange).toHaveBeenCalledWith('repo:Aisaac2205/mps-ecomerce')
  })

  it('filters the list as the user searches', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.type(screen.getByRole('searchbox'), 'qably')

    expect(screen.getAllByRole('radio')).toHaveLength(1)
    expect(screen.getByRole('radio', { name: /qably-project/ })).toBeInTheDocument()
  })

  it('matches the search case insensitively', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.type(screen.getByRole('searchbox'), 'QABLY')

    expect(screen.getAllByRole('radio')).toHaveLength(1)
  })

  it('tells the user when a search matches nothing instead of showing an empty box', async () => {
    const user = userEvent.setup()
    renderPicker()

    await user.type(screen.getByRole('searchbox'), 'nothing-matches-this')

    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.getByRole('status')).toHaveTextContent(/no repositor/i)
  })

  it('marks private repositories so the choice is informed', () => {
    renderPicker()

    expect(screen.getByRole('radio', { name: /vaultly-dumps.*private/i })).toBeInTheDocument()
  })

  it('lets the user pull a fresh listing from github', async () => {
    const user = userEvent.setup()
    const { onRefresh } = renderPicker()

    await user.click(screen.getByRole('button', { name: /refresh/i }))

    expect(onRefresh).toHaveBeenCalled()
  })

  it('explains the empty case instead of rendering a bare box', () => {
    renderPicker({ options: [] })

    expect(screen.getByRole('status')).toHaveTextContent(/no repositor/i)
  })

  it('announces that it is still loading rather than showing an empty list', () => {
    renderPicker({ options: [], isLoading: true })

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
  })

  it('keeps the current selection checked', () => {
    renderPicker({ value: 'conn-1' })

    expect(screen.getByRole('radio', { name: /vaultly-dumps/ })).toBeChecked()
  })
})
