import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { Tabs, TabsList, TabsTab, TabsPanel } from '@/components/ui/tabs'
import { expectFocusRing } from '@/features/runs/test/focus-ring'

function renderTabs() {
  return render(
    <Tabs defaultValue="tab1">
      <TabsList>
        <TabsTab value="tab1">First</TabsTab>
        <TabsTab value="tab2">Second</TabsTab>
      </TabsList>
      <TabsPanel value="tab1">Content 1</TabsPanel>
      <TabsPanel value="tab2">Content 2</TabsPanel>
    </Tabs>,
  )
}

describe('Tabs', () => {
  it('renders tabs and panels', () => {
    renderTabs()

    expect(screen.getByRole('tab', { name: 'First' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Second' })).toBeInTheDocument()
    expect(screen.getByText('Content 1')).toBeInTheDocument()
  })

  it('click switches active tab', async () => {
    const user = userEvent.setup()
    renderTabs()

    const secondTab = screen.getByRole('tab', { name: 'Second' })
    await user.click(secondTab)

    expect(secondTab).toHaveAttribute('aria-selected', 'true')
  })

  it('keyboard arrow keys navigate tabs', async () => {
    const user = userEvent.setup()
    renderTabs()

    screen.getByRole('tab', { name: 'First' }).focus()
    await user.keyboard('{ArrowRight}')

    expect(document.activeElement).toBe(
      screen.getByRole('tab', { name: 'Second' }),
    )
  })

  it('gives every tab a 44px target below md and 40px from md up', () => {
    renderTabs()

    const tabs = screen.getAllByRole('tab')

    expect(tabs).toHaveLength(2)
    for (const tab of tabs) {
      expect(tab).toHaveClass('min-h-11', 'md:min-h-10')
    }
  })

  it('marks the selected tab with the attribute Base UI sets and no other tab', () => {
    renderTabs()

    expect(screen.getByRole('tab', { name: 'First' })).toHaveAttribute('data-active')
    expect(screen.getByRole('tab', { name: 'Second' })).not.toHaveAttribute('data-active')
  })

  it('styles the selected tab only through attributes Base UI really sets', () => {
    renderTabs()
    const selected = screen.getByRole('tab', { name: 'First' })

    const targeted = [...selected.className.matchAll(/(?:^|\s)data-(?:\[([a-z-]+)\]|([a-z-]+)):/g)].map(
      (match) => match[1] ?? match[2],
    )

    expect(targeted).toContain('active')
    for (const name of targeted) {
      expect(selected).toHaveAttribute(`data-${name}`)
    }
  })

  it('draws the underline with important colors so the unlayered base border color cannot win', () => {
    renderTabs()

    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveClass('border-transparent!', 'data-active:border-primary!')
    }
  })

  it('drops the resting underline in forced colors so only the selected tab keeps one', () => {
    renderTabs()

    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveClass('forced-colors:border-b-0', 'forced-colors:data-active:border-b-2')
    }
  })

  it('carries the focus ring on every tab and on the open panel', () => {
    renderTabs()

    const tabs = screen.getAllByRole('tab')

    expect(tabs).toHaveLength(2)
    for (const tab of tabs) {
      expectFocusRing(tab)
    }
    expectFocusRing(screen.getByRole('tabpanel'))
  })

  it('fills the ring offset with the page background instead of white', () => {
    renderTabs()

    for (const element of [...screen.getAllByRole('tab'), screen.getByRole('tabpanel')]) {
      expect(element).toHaveClass('focus-visible:ring-offset-2', 'focus-visible:ring-offset-background')
    }
  })

  it('leaves the row height to the tabs so the two cannot drift apart', () => {
    renderTabs()

    const list = screen.getByRole('tablist')

    expect(list).not.toHaveClass('h-10')
    expect(list).toHaveClass('items-end', 'border-b')
  })
})
