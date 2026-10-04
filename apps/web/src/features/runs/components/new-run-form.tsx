'use client'

import { useState, useCallback } from 'react'
import { useSuites } from '@/features/projects/suites/hooks/use-suites'
import { useCreateRun } from '@/features/runs/hooks/use-create-run'
import { ApiError } from '@/lib/api-client'
import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useTranslation } from '@/lib/i18n'

function translateCreateRunError(error: unknown, t: (key: string) => string): string {
  if (error instanceof ApiError && error.status === 400) {
    return t('suites.cannotRunEmptySuite')
  }
  if (error instanceof ApiError && error.status === 409 && error.code === 'no-manual-cases') {
    return t('runs.noManualCases')
  }
  return t('runs.createRunError')
}

export function NewRunForm({
  projectId,
  initialSuiteId,
}: {
  projectId: string
  initialSuiteId?: string
}) {
  return (
    <DialogContent className="max-w-md">
      <NewRunFormBody projectId={projectId} initialSuiteId={initialSuiteId} />
    </DialogContent>
  )
}

function NewRunFormBody({
  projectId,
  initialSuiteId,
}: {
  projectId: string
  initialSuiteId?: string
}) {
  const { suites } = useSuites(projectId)
  const { start: createRun, error: createError } = useCreateRun(projectId)
  const { t } = useTranslation()
  const [suiteId, setSuiteId] = useState(initialSuiteId ?? '')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSuiteChange = useCallback((value: unknown) => {
    const v = String(value ?? '')
    setSuiteId(v)
    if (v) setError('')
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!suiteId) {
      setError(t('runs.pleaseSelectSuite'))
      return
    }
    setSubmitting(true)
    try {
      createRun(suiteId, name || undefined)
    } finally {
      setSubmitting(false)
    }
  }, [suiteId, name, createRun, t])

  const header = (
    <DialogHeader>
      <DialogTitle>{t('runs.newRun')}</DialogTitle>
      <DialogDescription>
        {suites.length === 0 ? t('runs.noSuitesAvailable') : t('runs.newRunDescription')}
      </DialogDescription>
    </DialogHeader>
  )
  const cancel = (
    <DialogClose className={buttonVariants({ variant: 'outline' })}>
      {t('common.cancel')}
    </DialogClose>
  )

  if (suites.length === 0) {
    return (
      <>
        {header}
        <DialogFooter>{cancel}</DialogFooter>
      </>
    )
  }

  return (
    <>
      {header}

      <div className="space-y-1.5">
        <label htmlFor="suite-select" className="text-xs font-medium text-default">
          {t('runs.suiteLabel')}
        </label>
        <Select
          value={suiteId}
          items={suites.map((s) => ({ value: s.id, label: s.name }))}
          onValueChange={handleSuiteChange}
        >
          <SelectTrigger id="suite-select">
            <SelectValue placeholder={t('runs.selectSuite')} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {suites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {(error || createError) && (
          <span className="text-xs text-fail" role="alert">
            {error || translateCreateRunError(createError, t)}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="run-name" className="text-xs font-medium text-default">
          {t('runs.runNameLabel')}{' '}
          <span className="text-muted font-normal">({t('common.optional')})</span>
        </label>
        <input
          id="run-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('runs.runNamePlaceholder')}
          className="w-full h-8 px-2.5 text-xs rounded border border-border bg-surface text-default
            placeholder:text-muted focus-visible:outline-2 focus-visible:outline-primary"
        />
      </div>

      <DialogFooter>
        {cancel}
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? t('runs.starting') : t('runs.startRun')}
        </Button>
      </DialogFooter>
    </>
  )
}
