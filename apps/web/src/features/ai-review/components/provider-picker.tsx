'use client'

import { Menu, MenuTrigger, MenuPortal, MenuPositioner, MenuContent, MenuItem } from '@/components/ui/menu'
import { CaretDown, Robot } from '@phosphor-icons/react'
import type { AiProvider, AiProviderConnection } from '@qably/types'

export function ProviderPicker({
  providers,
  selected,
  onSelect,
}: {
  providers: AiProviderConnection[]
  selected: AiProvider
  onSelect: (provider: AiProvider) => void
}) {
  const connected = providers.filter((p) => p.connected)
  const selectedProvider = connected.find((p) => p.provider === selected) ?? connected[0]

  return (
    <Menu>
      <MenuTrigger
        aria-label={`Selected AI provider: ${selectedProvider?.label ?? 'none'}`}
        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium text-default hover:bg-canvas transition-colors"
      >
        <Robot size={14} className="text-muted" aria-hidden="true" />
        {selectedProvider?.label ?? 'No provider'}
        <CaretDown size={11} className="text-muted" weight="bold" aria-hidden="true" />
      </MenuTrigger>
      <MenuPortal>
        <MenuPositioner>
          <MenuContent>
            {connected.map((provider) => (
              <MenuItem key={provider.provider} onClick={() => onSelect(provider.provider)}>
                {provider.label}
              </MenuItem>
            ))}
          </MenuContent>
        </MenuPositioner>
      </MenuPortal>
    </Menu>
  )
}
