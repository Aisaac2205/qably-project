'use client'

import { useState } from 'react'
import type { TestCase } from '@qably/types'
import { PriorityBadge } from './priority-badge'
import { CaretDown, CaretRight, DotsThree, PencilSimple, Trash } from '@phosphor-icons/react'
import { Menu, MenuContent, MenuItem, MenuPortal, MenuPositioner, MenuTrigger } from '@/components/ui/menu'
import { useTranslation } from '@/lib/i18n'

const STATE_CONFIG: Record<string, { labelKey: string; className: string }> = {
  active: { labelKey: 'suites.stateActive', className: 'bg-pass-bg text-pass' },
  draft: { labelKey: 'suites.stateDraft', className: 'bg-warn-bg text-warn' },
  deprecated: { labelKey: 'suites.stateDeprecated', className: 'bg-skip-bg text-muted' },
}

interface CaseCardProps {
  testCase: TestCase
  onEdit: (testCase: TestCase) => void
  onDelete: (testCase: TestCase) => void
}

export function CaseCard({ testCase, onEdit, onDelete }: CaseCardProps) {
  const { t } = useTranslation()
  const [stepsOpen, setStepsOpen] = useState(false)
  const [expectedOpen, setExpectedOpen] = useState(false)
  const stateConfig = STATE_CONFIG[testCase.state] ?? STATE_CONFIG.active

  return (
    <div className="py-2 px-3 hover:bg-canvas transition-colors rounded group">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-default truncate flex-1">
          {testCase.name}
        </span>
        <PriorityBadge priority={testCase.priority} />
        <span className={`inline-flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded ${stateConfig.className}`}>
          {t(stateConfig.labelKey)}
        </span>

        {/* Row actions — revealed on hover/focus so the list stays quiet */}
        <Menu>
          <MenuTrigger
            aria-label={t('suites.caseActions')}
            className="shrink-0 size-6 inline-flex items-center justify-center rounded text-muted hover:text-default hover:bg-surface-hover transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <DotsThree size={16} weight="bold" aria-hidden="true" />
          </MenuTrigger>
          <MenuPortal>
            <MenuPositioner align="end">
              <MenuContent>
                <MenuItem onClick={() => onEdit(testCase)}>
                  <PencilSimple size={14} aria-hidden="true" />
                  {t('suites.editCase')}
                </MenuItem>
                <MenuItem
                  onClick={() => onDelete(testCase)}
                  className="text-fail data-[highlighted]:bg-fail-bg data-[highlighted]:text-fail"
                >
                  <Trash size={14} aria-hidden="true" />
                  {t('suites.deleteCase')}
                </MenuItem>
              </MenuContent>
            </MenuPositioner>
          </MenuPortal>
        </Menu>
      </div>

      {/* Steps */}
      <div className="mt-1">
        <button
          onClick={() => setStepsOpen(!stepsOpen)}
          className="flex items-center gap-1 text-xs text-muted hover:text-default transition-colors focus-visible:outline-2 focus-visible:outline-primary"
          aria-expanded={stepsOpen}
          type="button"
        >
          {stepsOpen ? <CaretDown size={10} aria-hidden="true" /> : <CaretRight size={10} aria-hidden="true" />}
          {t('suites.stepsCount', { count: testCase.steps.length })}
        </button>
        {stepsOpen && (
          <ol className="mt-1 ml-3 text-xs text-muted space-y-0.5 list-decimal list-inside">
            {testCase.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}
      </div>

      {/* Expected result */}
      <div className="mt-1">
        <button
          onClick={() => setExpectedOpen(!expectedOpen)}
          className="flex items-center gap-1 text-xs text-muted hover:text-default transition-colors focus-visible:outline-2 focus-visible:outline-primary"
          aria-expanded={expectedOpen}
          type="button"
        >
          {expectedOpen ? <CaretDown size={10} aria-hidden="true" /> : <CaretRight size={10} aria-hidden="true" />}
          {t('suites.expectedResult')}
        </button>
        {expectedOpen && (
          <p className="mt-1 ml-3 text-xs text-muted">
            {testCase.expectedResult}
          </p>
        )}
      </div>
    </div>
  )
}
