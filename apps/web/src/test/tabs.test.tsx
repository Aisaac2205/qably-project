import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { Tabs, TabsList, TabsTab, TabsPanel } from '@/components/ui/tabs'

describe('Tabs', () => {
  it('renders tabs and panels', async () => {
    await act(async () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTab value="tab1">First</TabsTab>
            <TabsTab value="tab2">Second</TabsTab>
          </TabsList>
          <TabsPanel value="tab1">Content 1</TabsPanel>
          <TabsPanel value="tab2">Content 2</TabsPanel>
        </Tabs>,
      )
    })
    expect(screen.getByRole('tab', { name: 'First' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Second' })).toBeInTheDocument()
    expect(screen.getByText('Content 1')).toBeInTheDocument()
  })

  it('click switches active tab', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTab value="tab1">First</TabsTab>
            <TabsTab value="tab2">Second</TabsTab>
          </TabsList>
          <TabsPanel value="tab1">Content 1</TabsPanel>
          <TabsPanel value="tab2">Content 2</TabsPanel>
        </Tabs>,
      )
    })
    const secondTab = screen.getByRole('tab', { name: 'Second' })
    await act(async () => {
      await user.click(secondTab)
    })
    expect(secondTab).toHaveAttribute('aria-selected', 'true')
  })

  it('keyboard arrow keys navigate tabs', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTab value="tab1">First</TabsTab>
            <TabsTab value="tab2">Second</TabsTab>
          </TabsList>
          <TabsPanel value="tab1">Content 1</TabsPanel>
          <TabsPanel value="tab2">Content 2</TabsPanel>
        </Tabs>,
      )
    })
    const firstTab = screen.getByRole('tab', { name: 'First' })
    firstTab.focus()
    await act(async () => {
      await user.keyboard('{ArrowRight}')
    })
    const secondTab = screen.getByRole('tab', { name: 'Second' })
    expect(document.activeElement).toBe(secondTab)
  })
})
