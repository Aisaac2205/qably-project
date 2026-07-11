import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Menu, MenuTrigger, MenuPortal, MenuPositioner, MenuContent, MenuItem } from '@/components/ui/menu'

describe('Menu', () => {
  it('opens on trigger click and shows items', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(
        <Menu>
          <MenuTrigger>Open menu</MenuTrigger>
          <MenuPortal>
            <MenuPositioner>
              <MenuContent>
                <MenuItem>Option A</MenuItem>
                <MenuItem>Option B</MenuItem>
              </MenuContent>
            </MenuPositioner>
          </MenuPortal>
        </Menu>,
      )
    })
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(await screen.findByText('Option A')).toBeInTheDocument()
    expect(screen.getByText('Option B')).toBeInTheDocument()
  })

  it('calls onClick when an item is selected', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(
        <Menu>
          <MenuTrigger>Open menu</MenuTrigger>
          <MenuPortal>
            <MenuPositioner>
              <MenuContent>
                <MenuItem onClick={onSelect}>Option A</MenuItem>
              </MenuContent>
            </MenuPositioner>
          </MenuPortal>
        </Menu>,
      )
    })
    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    await user.click(await screen.findByText('Option A'))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })
})
