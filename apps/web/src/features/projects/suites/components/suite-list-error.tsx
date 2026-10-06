'use client'

import { useCallback, type ReactNode, type RefObject } from 'react'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'
import { isFocusHeldWithin } from '@/features/projects/suites/lib/is-focus-held-within'

interface SuiteListErrorProps {
  focusRegion: RefObject<HTMLElement | null>
  action: ReactNode
}

export function SuiteListError({ focusRegion, action }: SuiteListErrorProps) {
  const { t } = useTranslation()
  const takesFocus = useCallback(() => !isFocusHeldWithin(focusRegion), [focusRegion])

  return (
    <StateView
      kind="error"
      title={t('suites.loadError')}
      focusOnMount={takesFocus}
      action={action}
    />
  )
}
