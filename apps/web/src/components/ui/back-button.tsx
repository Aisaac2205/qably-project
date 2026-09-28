'use client'

import { CaretLeft } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'

interface BackButtonProps {
  onClick: () => void
  className?: string
}

export function BackButton({ onClick, className }: BackButtonProps) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('common.back')}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface',
        'text-muted transition-colors hover:bg-surface-hover hover:text-default',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
        className,
      )}
    >
      <CaretLeft size={16} weight="bold" aria-hidden="true" />
    </button>
  )
}
