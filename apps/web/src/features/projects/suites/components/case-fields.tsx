'use client'

/**
 * CaseFields — controlled field set for a single test case (title,
 * priority, state, objective, preconditions, steps, expected result).
 * Pure presentational: no mutations, no routing. Used by SuiteForm to
 * edit whichever case is currently selected, and by nothing else — case
 * creation/editing lives inline on the suite edit page now.
 */
import type { CasePriority, CaseState } from '@qably/types'
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

export interface CaseFieldsValue {
  name: string
  priority: CasePriority
  state: CaseState
  objective: string
  preconditions: string[]
  steps: string[]
  expectedResult: string
}

export function emptyCaseFields(): CaseFieldsValue {
  return {
    name: '',
    priority: 'medium',
    state: 'active',
    objective: '',
    preconditions: [],
    steps: [],
    expectedResult: '',
  }
}

export interface CaseFieldsProps {
  value: CaseFieldsValue
  onChange: (patch: Partial<CaseFieldsValue>) => void
  nameError: boolean
  onNameErrorClear: () => void
  automated?: { raw: string; filePath?: string }
  disabled?: boolean
}

export function CaseFields({
  value,
  onChange,
  nameError,
  onNameErrorClear,
  automated,
  disabled,
}: CaseFieldsProps) {
  const { t } = useTranslation()
  const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: t(PRIORITY_LABEL[p]) }))
  const STATE_OPTIONS = STATES.map((s) => ({ value: s, label: t(STATE_LABEL[s]) }))

  return (
    <fieldset disabled={disabled} className="m-0 min-w-0 space-y-5 border-0 p-0">
      <div className="grid gap-2">
        <Label htmlFor="case-name">{t('suites.caseNameLabel')}</Label>
        <Input
          id="case-name"
          value={value.name}
          onChange={(e) => {
            onChange({ name: e.target.value })
            if (nameError) onNameErrorClear()
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

      {automated && (
        <div className="grid gap-1.5 rounded-lg border border-border/70 bg-canvas/50 p-3">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-muted shrink-0">{t('cases.rawName')}</span>
            <span className="font-mono text-xs text-default truncate">{automated.raw}</span>
          </div>
          {automated.filePath && (
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-semibold text-muted shrink-0">{t('cases.filePath')}</span>
              <span className="font-mono text-xs text-default truncate">{automated.filePath}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="case-priority">{t('suites.priorityLabel')}</Label>
          <Select
            value={value.priority}
            items={PRIORITY_OPTIONS}
            onValueChange={(v) => onChange({ priority: v as CasePriority })}
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
            value={value.state}
            items={STATE_OPTIONS}
            onValueChange={(v) => onChange({ state: v as CaseState })}
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
          value={value.objective}
          onChange={(e) => onChange({ objective: e.target.value })}
          placeholder={t('suites.objectivePlaceholder')}
        />
      </div>

      <StepListField
        label={t('suites.preconditionsLabel')}
        hint={t('suites.preconditionsHint')}
        values={value.preconditions}
        onChange={(preconditions) => onChange({ preconditions })}
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
        values={value.steps}
        onChange={(steps) => onChange({ steps })}
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
          value={value.expectedResult}
          onChange={(e) => onChange({ expectedResult: e.target.value })}
          placeholder={t('suites.expectedResultPlaceholder')}
          rows={2}
        />
      </div>
    </fieldset>
  )
}
