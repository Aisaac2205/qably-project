'use client'

/**
 * CaseFormDialog — create + edit form for test cases.
 *
 * Cases live embedded in `Suite.cases`; the store mutators
 * (createCase / updateCase) take the suiteId and bump the suite's
 * updatedAt. Steps are edited as plain text, one step per line.
 */
import { useEffect, useState } from 'react'
import type { CasePriority, CaseState, TestCase } from '@qably/types'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createCase, updateCase } from '@/lib/mock-store'
import { useTranslation } from '@/lib/i18n'

const PRIORITIES: CasePriority[] = ['critical', 'high', 'medium', 'low']
const STATES: CaseState[] = ['active', 'draft', 'deprecated']

const PRIORITY_LABEL: Record<CasePriority, string> = {
  critical: 'suites.priorityCritical',
  high: 'suites.priorityHigh',
  medium: 'suites.priorityMedium',
  low: 'suites.priorityLow',
}

const STATE_LABEL: Record<CaseState, string> = {
  active: 'suites.stateActive',
  draft: 'suites.stateDraft',
  deprecated: 'suites.stateDeprecated',
}

interface CaseFormDialogProps {
  suiteId: string
  testCase?: TestCase
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CaseFormDialog({ suiteId, testCase, open, onOpenChange }: CaseFormDialogProps) {
  const { t } = useTranslation()
  const isEdit = testCase !== undefined

  const [name, setName] = useState('')
  const [priority, setPriority] = useState<CasePriority>('medium')
  const [state, setState] = useState<CaseState>('active')
  const [steps, setSteps] = useState('')
  const [expectedResult, setExpectedResult] = useState('')
  const [nameError, setNameError] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(testCase?.name ?? '')
    setPriority(testCase?.priority ?? 'medium')
    setState(testCase?.state ?? 'active')
    setSteps(testCase?.steps.join('\n') ?? '')
    setExpectedResult(testCase?.expectedResult ?? '')
    setNameError(false)
  }, [open, testCase])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError(true)
      return
    }
    const stepList = steps
      .split('\n')
      .map((step) => step.trim())
      .filter(Boolean)

    if (isEdit) {
      updateCase(suiteId, testCase.id, {
        name: trimmed,
        priority,
        state,
        steps: stepList,
        expectedResult: expectedResult.trim(),
      })
    } else {
      createCase(suiteId, {
        name: trimmed,
        priority,
        state,
        steps: stepList,
        expectedResult: expectedResult.trim(),
      })
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('suites.editCase') : t('suites.addCase')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="case-name">{t('suites.caseNameLabel')}</Label>
            <Input
              id="case-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError(false)
              }}
              placeholder={t('suites.caseNamePlaceholder')}
              aria-invalid={nameError}
              autoFocus
            />
            {nameError && (
              <p role="alert" className="text-xs text-fail">
                {t('suites.caseNameRequired')}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="case-priority">{t('suites.priorityLabel')}</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as CasePriority)}
              >
                <SelectTrigger id="case-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(PRIORITY_LABEL[p])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="case-state">{t('suites.stateLabel')}</Label>
              <Select
                value={state}
                onValueChange={(value) => setState(value as CaseState)}
              >
                <SelectTrigger id="case-state">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(STATE_LABEL[s])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="case-steps">{t('suites.stepsLabel')}</Label>
            <Textarea
              id="case-steps"
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              placeholder={t('suites.stepsPlaceholder')}
              rows={4}
              aria-describedby="case-steps-hint"
            />
            <p id="case-steps-hint" className="text-xs text-muted">
              {t('suites.stepsHint')}
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="case-expected">{t('suites.expectedResultLabel')}</Label>
            <Textarea
              id="case-expected"
              value={expectedResult}
              onChange={(e) => setExpectedResult(e.target.value)}
              placeholder={t('suites.expectedResultPlaceholder')}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit">{isEdit ? t('common.save') : t('suites.createCase')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
