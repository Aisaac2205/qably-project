'use client'

import { useState, useCallback } from 'react'
import { useSuites } from '@/lib/use-mock-store'
import { useCreateRun } from '@/features/runs/hooks/use-create-run'
import {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'

export function NewRunForm({
  projectId,
  initialSuiteId,
}: {
  projectId: string
  initialSuiteId?: string
}) {
  const suites = useSuites(projectId)
  const createRun = useCreateRun(projectId)
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

  if (suites.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted">
        {t('runs.noSuitesAvailable')}
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-lg font-semibold text-default">{t('runs.newRun')}</h1>

      <div className="space-y-1.5">
        <label htmlFor="suite-select" className="text-xs font-medium text-default">
          {t('runs.suiteLabel')}
        </label>
        <Select value={suiteId} onValueChange={handleSuiteChange}>
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
        {error && (
          <span className="text-xs text-fail" role="alert">
            {error}
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

      <Button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full"
      >
        {submitting ? t('runs.starting') : t('runs.startRun')}
      </Button>
    </div>
  )
}
