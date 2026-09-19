'use client'

import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface SecretCardAction {
  label: string
  icon: ReactNode
  onClick: () => void
  disabled?: boolean
}

interface SecretCardProps {
  icon: ReactNode
  title: string
  description: string
  headingId: string
  action: SecretCardAction
  error?: string
}

export function SecretCard({
  icon,
  title,
  description,
  headingId,
  action,
  error,
}: SecretCardProps) {
  return (
    <section
      className="rounded-2xl border border-border/70 bg-surface p-6 sm:p-7 shadow-xs hover:border-border transition-colors duration-150 space-y-3"
      aria-labelledby={headingId}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-canvas/80 text-default shadow-2xs">
            {icon}
          </div>
          <div className="min-w-0">
            <h2 id={headingId} className="text-base font-semibold text-default tracking-tight">
              {title}
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-muted">{description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.icon}
            {action.label}
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-xs font-medium text-fail">
          {error}
        </p>
      ) : null}
    </section>
  )
}
