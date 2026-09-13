'use client'

import { Toaster as SonnerToaster } from 'sonner'
import { CheckCircle, Info, Warning, WarningCircle, X } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export const TOAST_DURATION_MS = 5_000

export function Toaster() {
  const { t } = useTranslation()

  return (
    <SonnerToaster
      position="bottom-right"
      closeButton
      duration={TOAST_DURATION_MS}
      gap={12}
      offset={20}
      icons={{
        success: <CheckCircle size={18} weight="fill" aria-hidden="true" className="text-pass" />,
        info: <Info size={18} weight="fill" aria-hidden="true" className="text-default" />,
        warning: <Warning size={18} weight="fill" aria-hidden="true" className="text-warn" />,
        error: <WarningCircle size={18} weight="fill" aria-hidden="true" className="text-fail" />,
        close: <X size={14} weight="bold" aria-hidden="true" />,
      }}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: t('common.dismiss'),
        classNames: {
          toast:
            'group flex w-full items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-card',
          icon: 'mt-0.5 shrink-0',
          content: 'flex min-w-0 flex-1 flex-col gap-0.5',
          title: 'text-sm font-semibold text-default',
          description: 'text-xs text-muted',
          closeButton:
            'shrink-0 rounded text-muted transition-colors hover:text-default focus-visible:outline-2 focus-visible:outline-primary',
        },
      }}
    />
  )
}
