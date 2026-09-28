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
      className="rounded-lg border border-border bg-surface px-4 py-3 sm:px-5 sm:py-3.5 space-y-3"
      aria-labelledby={headingId}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 text-default">{icon}</span>
          <div className="min-w-0">
            <h2 id={headingId} className="truncate text-sm font-semibold text-default">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-muted">{description}</p>
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
