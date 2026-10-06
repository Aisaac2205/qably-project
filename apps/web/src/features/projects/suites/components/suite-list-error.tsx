'use client'

import { useState, type ReactNode } from 'react'
import { StateView } from '@/components/ui/state-view'
import { useTranslation } from '@/lib/i18n'
import { isFocusFree } from '@/features/projects/suites/lib/is-focus-free'

interface SuiteListErrorProps {
  action: ReactNode
}

export function SuiteListError({ action }: SuiteListErrorProps) {
  const { t } = useTranslation()
  const [takesFocus] = useState(() => isFocusFree())

  return (
    <StateView
      kind="error"
      title={t('suites.loadError')}
      focusOnMount={takesFocus}
      action={action}
    />
  )
}
