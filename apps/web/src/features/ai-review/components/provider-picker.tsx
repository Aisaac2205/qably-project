'use client'

import { Menu, MenuTrigger, MenuPortal, MenuPositioner, MenuContent, MenuItem } from '@/components/ui/menu'
import { CaretDown, Robot } from '@phosphor-icons/react'
import { GeminiIcon } from '@/components/icons/gemini-icon'
import type { AiProvider, AiProviderConnection } from '@qably/types'
import { useTranslation } from '@/lib/i18n'

export function ProviderPicker({
  providers,
  selected,
  onSelect,
}: {
  providers: AiProviderConnection[]
  selected: AiProvider
  onSelect: (provider: AiProvider) => void
}) {
  const { t } = useTranslation()
  const connected = providers.filter((p) => p.connected)
  const selectedProvider = connected.find((p) => p.provider === selected) ?? connected[0]

  return (
    <Menu>
      <MenuTrigger
        aria-label={t('aiReview.selectedProvider', { name: selectedProvider?.label ?? t('common.none') })}
        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-xs font-medium text-default hover:bg-canvas transition-colors"
      >
        {selectedProvider?.provider === 'gemini' ? (
          <GeminiIcon className="size-3.5 shrink-0" />
        ) : (
          <Robot size={14} className="text-muted" aria-hidden="true" />
        )}
        {selectedProvider?.label ?? t('aiReview.noProviderLabel')}
        <CaretDown size={11} className="text-muted" weight="bold" aria-hidden="true" />
      </MenuTrigger>
      <MenuPortal>
        <MenuPositioner>
          <MenuContent>
            {connected.map((provider) => (
              <MenuItem key={provider.provider} onClick={() => onSelect(provider.provider)} className="flex items-center gap-1.5">
                {provider.provider === 'gemini' && <GeminiIcon className="size-3.5 shrink-0" />}
                <span>{provider.label}</span>
              </MenuItem>
            ))}
          </MenuContent>
        </MenuPositioner>
      </MenuPortal>
    </Menu>
  )
}
