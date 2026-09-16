'use client'

/**
 * CaseForm — full-page create + edit form for test cases.
 *
 * One page, two modes:
 *   - `testCase` undefined → create mode (calls createCase)
 *   - `testCase` provided  → edit mode (calls updateCase)
 * Preconditions and steps are ordered lists (StepListField) instead of
 * a one-line-per-item textarea.
 */
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { CasePriority, CaseState, TestCase } from '@qably/types'
import { CaretLeft } from '@phosphor-icons/react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StepListField } from '@/components/ui/step-list-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateCase, useUpdateCase } from '@/features/projects/suites/hooks/use-suite-mutations'
import { describeCase } from '@/features/projects/suites/lib/case-title'
import { useTranslation } from '@/lib/i18n'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'

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

export function CaseForm({
  projectId,
  suiteId,
  testCase,
}: {
  projectId: string
  suiteId: string
  testCase?: TestCase
}) {
  const router = useRouter()
  const { t } = useTranslation()
  const isEdit = testCase !== undefined
  const createCaseMutation = useCreateCase()
  const updateCaseMutation = useUpdateCase()

  const described = testCase === undefined ? undefined : describeCase(testCase)
  const isAutomated = described?.isAutomated ?? false

  const [name, setName] = useState(described?.title ?? testCase?.name ?? '')
  const [priority, setPriority] = useState<CasePriority>(testCase?.priority ?? 'medium')
  const [state, setState] = useState<CaseState>(testCase?.state ?? 'active')
  const [objective, setObjective] = useState(testCase?.objective ?? '')
  const [preconditions, setPreconditions] = useState<string[]>(testCase?.preconditions ?? [])
  const [steps, setSteps] = useState<string[]>(testCase?.steps ?? [])
  const [expectedResult, setExpectedResult] = useState(testCase?.expectedResult ?? '')
  const [nameError, setNameError] = useState(false)

  const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: t(PRIORITY_LABEL[p]) }))
  const STATE_OPTIONS = STATES.map((s) => ({ value: s, label: t(STATE_LABEL[s]) }))

  const backHref = `/projects/${projectId}/suites/${suiteId}`
  const isPending = createCaseMutation.isPending || updateCaseMutation.isPending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError(true)
      return
    }
    const stepList = steps.map((step) => step.trim()).filter(Boolean)
    const preconditionList = preconditions.map((precondition) => precondition.trim()).filter(Boolean)

    const payload = {
      name: trimmed,
      priority,
      state,
      objective: objective.trim(),
      preconditions: preconditionList,
      steps: stepList,
      expectedResult: expectedResult.trim(),
    }

    if (isEdit) {
      updateCaseMutation.mutate(
        { suiteId, caseId: testCase.id, patch: payload },
        {
          onSuccess: () => router.push(backHref),
          onError: () => notify.error(t('suites.saveCaseError')),
        },
      )
    } else {
      createCaseMutation.mutate(
        { suiteId, payload },
        {
          onSuccess: () => router.push(backHref),
          onError: () => notify.error(t('suites.saveCaseError')),
        },
      )
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 px-5 py-6 sm:px-7 lg:py-8 animate-page-enter">
      <div className="flex items-center gap-1.5">
        <Link
          href={backHref}
          aria-label={t('common.back')}
          className="shrink-0 size-6 inline-flex items-center justify-center rounded text-muted hover:text-default hover:bg-surface-hover transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
        >
          <CaretLeft size={14} weight="bold" aria-hidden="true" />
        </Link>
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-default">
          {isEdit ? t('suites.editCase') : t('suites.addCase')}
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card"
        noValidate
      >
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

        {isAutomated && described && (
          <div className="grid gap-1.5 rounded-lg border border-border/70 bg-canvas/50 p-3">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-muted shrink-0">{t('cases.rawName')}</span>
              <span className="font-mono text-xs text-default truncate">{described.raw}</span>
            </div>
            {testCase?.automationFilePath && (
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-muted shrink-0">{t('cases.filePath')}</span>
                <span className="font-mono text-xs text-default truncate">
                  {testCase.automationFilePath}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="case-priority">{t('suites.priorityLabel')}</Label>
            <Select
              value={priority}
              items={PRIORITY_OPTIONS}
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
              items={STATE_OPTIONS}
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
          <Label htmlFor="case-objective">{t('suites.objectiveLabel')}</Label>
          <Input
            id="case-objective"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder={t('suites.objectivePlaceholder')}
          />
        </div>

        <StepListField
          label={t('suites.preconditionsLabel')}
          hint={t('suites.preconditionsHint')}
          values={preconditions}
          onChange={setPreconditions}
          addLabel={t('suites.addPrecondition')}
          itemPlaceholder={t('suites.preconditionItemPlaceholder')}
          itemAriaLabel={(index) => t('suites.preconditionAriaLabel', { number: index + 1 })}
          moveUpLabel={t('suites.moveItemUp')}
          moveDownLabel={t('suites.moveItemDown')}
          removeLabel={t('suites.removeItem')}
        />

        <StepListField
          label={t('suites.stepsLabel')}
          hint={t('suites.stepsHint')}
          values={steps}
          onChange={setSteps}
          addLabel={t('suites.addStep')}
          itemPlaceholder={t('suites.stepItemPlaceholder')}
          itemAriaLabel={(index) => t('suites.stepAriaLabel', { number: index + 1 })}
          moveUpLabel={t('suites.moveItemUp')}
          moveDownLabel={t('suites.moveItemDown')}
          removeLabel={t('suites.removeItem')}
        />

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

        <div className="flex items-center justify-end gap-2 pt-2">
          <Link href={backHref} className={cn(buttonVariants({ variant: 'outline' }))}>
            {t('common.cancel')}
          </Link>
          <Button type="submit" disabled={isPending}>
            {isEdit ? t('common.save') : t('suites.createCase')}
          </Button>
        </div>
      </form>
    </div>
  )
}
