'use client'

import { useEffect, useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from '@phosphor-icons/react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { projectRunsPath } from '@/features/projects/lib/routes'
import { NewRunForm } from '@/features/runs/components/new-run-form'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const ACTION_FOCUS =
  'focus-visible:outline-hidden! focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'

export function NewRunAction({
  projectId,
  disabled,
  initialSuiteId,
  routeBound = false,
}: {
  projectId: string
  disabled: boolean
  initialSuiteId?: string
  routeBound?: boolean
}) {
  const { t } = useTranslation()
  const { replace } = useRouter()
  const hintId = useId()
  const [open, setOpen] = useState(routeBound)
  const [preselectedSuiteId, setPreselectedSuiteId] = useState(initialSuiteId)
  const [pending, setPending] = useState(false)
  const listHref = projectRunsPath(projectId, 'manual')

  useEffect(() => {
    if (routeBound && disabled) replace(listHref, { scroll: false })
  }, [routeBound, disabled, replace, listHref])

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
      <Dialog
        open={open}
        onOpenChange={(next, eventDetails) => {
          if (!next && pending) {
            eventDetails.cancel()
            return
          }
          setOpen(next)
          if (next) return

          setPreselectedSuiteId(undefined)
          if (routeBound) replace(listHref, { scroll: false })
        }}
      >
        <DialogTrigger className={cn(buttonVariants(), 'w-full md:w-auto', ACTION_FOCUS)}>
          <Plus size={16} weight="bold" aria-hidden="true" />
          {t('runs.newRun')}
        </DialogTrigger>
        <NewRunForm
          projectId={projectId}
          initialSuiteId={preselectedSuiteId}
          replaceOnCreate={routeBound}
          pending={pending}
          onPendingChange={setPending}
        />
      </Dialog>
    </div>
  )
}
