'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from '@phosphor-icons/react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'
import { projectRunsPath } from '@/features/projects/lib/routes'
import { NewRunForm } from '@/features/runs/components/new-run-form'
import { consumeNewRunFocus, requestNewRunFocus } from '@/features/runs/lib/new-run-focus'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const ACTION_FOCUS =
  'focus-visible:outline-hidden! focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'

export function NewRunAction({
  projectId,
  disabled,
  loading = false,
  initialSuiteId,
  routeBound = false,
}: {
  projectId: string
  disabled: boolean
  loading?: boolean
  initialSuiteId?: string
  routeBound?: boolean
}) {
  const { t } = useTranslation()
  const { replace } = useRouter()
  const hintId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [routeOpened, setRouteOpened] = useState(false)
  const [preselectedSuiteId, setPreselectedSuiteId] = useState(initialSuiteId)
  const [pending, setPending] = useState(false)
  const listHref = projectRunsPath(projectId, 'manual')

  if (routeBound && !loading && !disabled && !routeOpened) {
    setRouteOpened(true)
    setOpen(true)
  }

  useEffect(() => {
    if (routeBound && disabled) replace(listHref, { scroll: false })
  }, [routeBound, disabled, replace, listHref])

  useEffect(() => {
    if (routeBound || !consumeNewRunFocus(projectId)) return

    const target = disabled ? document.getElementById('main-content') : triggerRef.current
    target?.focus({ preventScroll: true })
  }, [routeBound, disabled, projectId])

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
          if (!routeBound) return

          requestNewRunFocus(projectId)
          replace(listHref, { scroll: false })
        }}
      >
        <DialogTrigger ref={triggerRef} className={cn(buttonVariants(), 'w-full md:w-auto', ACTION_FOCUS)}>
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
