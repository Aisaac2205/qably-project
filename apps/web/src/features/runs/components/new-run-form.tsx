'use client'

import { useCallback, useEffect, useId, useState, type FormEvent } from 'react'
import { useSuites } from '@/features/projects/suites/hooks/use-suites'
import { useCreateRun } from '@/features/runs/hooks/use-create-run'
import { ApiError } from '@/lib/api-client'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { useTranslation } from '@/lib/i18n'
import { cn } from '@/lib/utils'

const FIELD_FOCUS =
  'focus-visible:outline-hidden! focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'

const FIELD_TEXT = 'text-base md:text-sm'

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
  replaceOnCreate = false,
  pending = false,
  onPendingChange,
}: {
  projectId: string
  initialSuiteId?: string
  replaceOnCreate?: boolean
  pending?: boolean
  onPendingChange?: (pending: boolean) => void
}) {
  return (
    <DialogContent className="max-w-md" closeDisabled={pending}>
      <NewRunFormBody
        projectId={projectId}
        initialSuiteId={initialSuiteId}
        replaceOnCreate={replaceOnCreate}
        onPendingChange={onPendingChange}
      />
    </DialogContent>
  )
}

function NewRunFormBody({
  projectId,
  initialSuiteId,
  replaceOnCreate,
  onPendingChange,
}: {
  projectId: string
  initialSuiteId?: string
  replaceOnCreate: boolean
  onPendingChange?: (pending: boolean) => void
}) {
  const { suites, isLoading } = useSuites(projectId)
  const { start: createRun, error: createError } = useCreateRun(projectId, { replaceOnCreate })
  const { t } = useTranslation()
  const suiteFieldId = useId()
  const nameFieldId = useId()
  const messageId = useId()
  const [chosenSuiteId, setChosenSuiteId] = useState(initialSuiteId ?? '')
  const [name, setName] = useState('')
  const [validationError, setValidationError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const suiteId = suites.some((suite) => suite.id === chosenSuiteId) ? chosenSuiteId : ''
  const pending = submitted && createError == null
  const message = validationError || (createError ? translateCreateRunError(createError, t) : '')
  const hasNoSuites = !isLoading && suites.length === 0

  useEffect(() => {
    onPendingChange?.(pending)
  }, [pending, onPendingChange])

  const handleSuiteChange = useCallback((value: unknown) => {
    const next = String(value ?? '')
    setChosenSuiteId(next)
    if (next) setValidationError('')
  }, [])

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault()
      if (pending) return
      if (!suiteId) {
        setValidationError(t('runs.pleaseSelectSuite'))
        return
      }
      setValidationError('')
      setSubmitted(true)
      createRun(suiteId, name || undefined)
    },
    [pending, suiteId, name, createRun, t],
  )

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('runs.newRun')}</DialogTitle>
        <DialogDescription>
          {hasNoSuites ? t('runs.noSuitesAvailable') : t('runs.newRunDescription')}
        </DialogDescription>
      </DialogHeader>

      {hasNoSuites ? (
        <DialogFooter>
          <DialogClose
            className={cn(buttonVariants({ variant: 'outline' }), FIELD_FOCUS)}
          >
            {t('common.cancel')}
          </DialogClose>
        </DialogFooter>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="grid gap-4">
          <Field data-invalid={validationError ? true : undefined}>
            <FieldLabel htmlFor={suiteFieldId}>{t('runs.suiteLabel')}</FieldLabel>
            <Select
              value={suiteId}
              items={suites.map((suite) => ({ value: suite.id, label: suite.name }))}
              onValueChange={handleSuiteChange}
            >
              <SelectTrigger
                id={suiteFieldId}
                aria-invalid={validationError ? true : undefined}
                aria-describedby={message ? messageId : undefined}
                className={cn(
                  'h-auto min-h-11 py-2 text-left md:h-auto md:min-h-10',
                  '[&>span]:line-clamp-none [&>span]:wrap-anywhere',
                  FIELD_TEXT,
                  FIELD_FOCUS,
                )}
              >
                <SelectValue placeholder={t('runs.selectSuite')} className={FIELD_TEXT} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {suites.map((suite) => (
                    <SelectItem
                      key={suite.id}
                      value={suite.id}
                      className={cn('min-h-11 wrap-anywhere md:min-h-0', FIELD_TEXT)}
                    >
                      {suite.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {message && <FieldError id={messageId}>{message}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor={nameFieldId}>
              {t('runs.runNameLabel')}{' '}
              <span className="font-normal text-muted">({t('common.optional')})</span>
            </FieldLabel>
            <Input
              id={nameFieldId}
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t('runs.runNamePlaceholder')}
              className={cn('h-11 md:h-10', FIELD_TEXT, FIELD_FOCUS)}
            />
          </Field>

          <DialogFooter>
            <DialogClose
              disabled={pending}
              className={cn(buttonVariants({ variant: 'outline' }), FIELD_FOCUS)}
            >
              {t('common.cancel')}
            </DialogClose>
            <Button
              type="submit"
              disabled={pending || isLoading}
              focusableWhenDisabled
              className={FIELD_FOCUS}
            >
              {pending && <Spinner size="sm" />}
              {pending ? t('runs.starting') : t('runs.startRun')}
            </Button>
          </DialogFooter>
          <span role="status" aria-live="polite" className="sr-only">
            {pending ? t('runs.starting') : null}
          </span>
        </form>
      )}
    </>
  )
}
