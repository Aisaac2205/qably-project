'use client'

import { CaretLeft } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n'

interface BackButtonProps {
  onClick: () => void
  label?: string
  className?: string
}

export function BackButton({ onClick, label, className }: BackButtonProps) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? t('common.back')}
      title={label}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface md:size-8',
        'text-muted transition-colors hover:bg-surface-hover hover:text-default',
        'outline-none focus-visible:ring-2 focus-visible:ring-primary',
        className,
      )}
    >
      <CaretLeft size={16} weight="bold" aria-hidden="true" />
    </button>
  )
}
