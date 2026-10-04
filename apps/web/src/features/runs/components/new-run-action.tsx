'use client'

import { useId } from 'react'
import Link from 'next/link'
import { Plus } from '@phosphor-icons/react'
import { Button, buttonVariants } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const ACTION_FOCUS =
  'focus-visible:outline-hidden! focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'

export function NewRunAction({ projectId, disabled }: { projectId: string; disabled: boolean }) {
  const { t } = useTranslation()
  const hintId = useId()

  if (disabled) {
    return (
      <div className="flex flex-col gap-1 md:items-end">
        <Button
          type="button"
          disabled
          focusableWhenDisabled
          aria-describedby={hintId}
          className={cn('w-full md:w-auto', ACTION_FOCUS)}
        >
          <Plus size={16} weight="bold" aria-hidden="true" />
          {t('runs.newRun')}
        </Button>
        <p id={hintId} className="text-xs text-muted md:max-w-64 md:text-right">
          {t('runs.noManualCasesInProject')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex md:justify-end">
      <Link
        href={`/projects/${projectId}/runs/new`}
        className={cn(buttonVariants(), 'w-full md:w-auto', ACTION_FOCUS)}
      >
        <Plus size={16} weight="bold" aria-hidden="true" />
        {t('runs.newRun')}
      </Link>
    </div>
  )
}
