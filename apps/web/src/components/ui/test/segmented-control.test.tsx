import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { SegmentedControl } from '@/components/ui/segmented-control'

const options = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
] as const

describe('SegmentedControl', () => {
  it('paints the selected option with the primary surface', () => {
    render(
      <SegmentedControl
        label="Status"
        options={options}
        value="open"
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Open' })).toHaveClass('bg-primary')
    expect(screen.getByRole('button', { name: 'All' })).not.toHaveClass('bg-primary')
  })

  it('describes a filter group as pressed buttons', () => {
    render(
      <SegmentedControl
        label="Status"
        options={options}
        value="open"
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('group', { name: 'Status' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryAllByRole('tab')).toHaveLength(0)
  })

  it('describes a view switcher as a tablist bound to its panels', () => {
    render(
      <SegmentedControl
        label="View"
        semantics="tabs"
        options={[
          { value: 'queue', label: 'Queue', id: 'tab-queue', controls: 'panel-queue' },
          { value: 'chat', label: 'Chat', id: 'tab-chat', controls: 'panel-chat' },
        ]}
        value="chat"
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('tablist', { name: 'View' })).toBeInTheDocument()

    const selected = screen.getByRole('tab', { name: 'Chat' })
    expect(selected).toHaveAttribute('aria-selected', 'true')
    expect(selected).toHaveAttribute('aria-controls', 'panel-chat')
    expect(selected).toHaveAttribute('id', 'tab-chat')
    expect(selected).not.toHaveAttribute('tabindex', '-1')

    expect(screen.getByRole('tab', { name: 'Queue' })).toHaveAttribute('tabindex', '-1')
  })

  it('moves between tabs with the arrow, home and end keys', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <SegmentedControl
        label="Status"
        semantics="tabs"
        options={options}
        value="open"
        onChange={onChange}
      />,
    )

    const selected = screen.getByRole('tab', { name: 'Open' })
    selected.focus()

    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('closed')

    await user.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith('all')

    await user.keyboard('{Home}')
    expect(onChange).toHaveBeenLastCalledWith('all')

    await user.keyboard('{End}')
    expect(onChange).toHaveBeenLastCalledWith('closed')
  })

  it('wraps around at both ends of the tablist', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    const { rerender } = render(
      <SegmentedControl
        label="Status"
        semantics="tabs"
        options={options}
        value="closed"
        onChange={onChange}
      />,
    )
    screen.getByRole('tab', { name: 'Closed' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith('all')

    rerender(
      <SegmentedControl
        label="Status"
        semantics="tabs"
        options={options}
        value="all"
        onChange={onChange}
      />,
    )
    screen.getByRole('tab', { name: 'All' }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenLastCalledWith('closed')
  })

  it('leaves the arrow keys alone in a filter group, where tab order is the way through', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <SegmentedControl
        label="Status"
        options={options}
        value="open"
        onChange={onChange}
      />,
    )

    screen.getByRole('button', { name: 'Open' }).focus()
    await user.keyboard('{ArrowRight}')

    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'All' })).not.toHaveAttribute('tabindex', '-1')
  })

  it('reports the option the user clicked', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()

    render(
      <SegmentedControl
        label="Status"
        options={options}
        value="open"
        onChange={onChange}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Closed' }))
    expect(onChange).toHaveBeenCalledWith('closed')
  })
})
