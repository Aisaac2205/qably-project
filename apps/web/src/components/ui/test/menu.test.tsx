import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import {
  Menu,
  MenuTrigger,
  MenuPortal,
  MenuPositioner,
  MenuContent,
  MenuItem,
  MenuGroup,
  MenuGroupLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRadioItemIndicator,
  MenuSeparator,
} from '@/components/ui/menu'

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

  it('lets a radio group switch the checked item and reports the new value', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    await act(async () => {
      render(
        <Menu>
          <MenuTrigger>Open menu</MenuTrigger>
          <MenuPortal>
            <MenuPositioner>
              <MenuContent>
                <MenuGroup>
                  <MenuGroupLabel>Organization</MenuGroupLabel>
                  <MenuRadioGroup value="org-1" onValueChange={onValueChange}>
                    <MenuRadioItem value="org-1">
                      <MenuRadioItemIndicator>✓</MenuRadioItemIndicator>
                      Acme QA Team
                    </MenuRadioItem>
                    <MenuRadioItem value="org-2">
                      <MenuRadioItemIndicator>✓</MenuRadioItemIndicator>
                      Globex Labs
                    </MenuRadioItem>
                  </MenuRadioGroup>
                </MenuGroup>
                <MenuSeparator />
                <MenuItem>Sign out</MenuItem>
              </MenuContent>
            </MenuPositioner>
          </MenuPortal>
        </Menu>,
      )
    })

    await user.click(screen.getByRole('button', { name: 'Open menu' }))
    expect(await screen.findByText('Organization')).toBeInTheDocument()
    expect(screen.getByRole('menuitemradio', { name: 'Acme QA Team' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('menuitemradio', { name: 'Globex Labs' })).toHaveAttribute(
      'aria-checked',
      'false',
    )

    await user.click(screen.getByRole('menuitemradio', { name: 'Globex Labs' }))
    expect(onValueChange).toHaveBeenCalledWith('org-2', expect.anything())
  })
})
