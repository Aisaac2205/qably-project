'use client'

import { useState } from 'react'
import type { TestCase } from '@qably/types'
import { PriorityBadge } from './priority-badge'
import { CaretDown, CaretRight, DotsThree, PencilSimple, Trash } from '@phosphor-icons/react'
import { Menu, MenuContent, MenuItem, MenuPortal, MenuPositioner, MenuTrigger } from '@/components/ui/menu'
import { useTranslation } from '@/lib/i18n'
import { StatusChip } from '@/components/ui/status-chip'

interface CaseCardProps {
  testCase: TestCase
  onEdit: (testCase: TestCase) => void
  onDelete: (testCase: TestCase) => void
}

export function CaseCard({ testCase, onEdit, onDelete }: CaseCardProps) {
  const { t } = useTranslation()
  const [stepsOpen, setStepsOpen] = useState(false)
  const [expectedOpen, setExpectedOpen] = useState(false)

  return (
    <div className="py-4 px-4 sm:px-5 group bg-surface space-y-2.5">
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-sm font-semibold text-default truncate flex-1 min-w-[200px]">
          {testCase.name}
        </span>
        <span className="rounded bg-canvas border border-border px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
          v{testCase.version}
        </span>
        <PriorityBadge priority={testCase.priority} />
        <StatusChip status={testCase.state} scope="lifecycle" />

        {/* Row actions */}
        <Menu>
          <MenuTrigger
            aria-label={t('suites.caseActions')}
            className="shrink-0 size-6 inline-flex items-center justify-center rounded text-muted hover:text-default hover:bg-surface-hover transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100 outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
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

      {/* Steps, Expected result, & Traceability toggles */}
      <div className="flex flex-wrap items-center gap-2">
        {testCase.steps.length > 0 ? (
          <button
            onClick={() => setStepsOpen(!stepsOpen)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-default hover:text-primary transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md py-1 px-2.5 bg-canvas/70 border border-border/70 cursor-pointer"
            aria-expanded={stepsOpen}
            type="button"
          >
            {stepsOpen ? <CaretDown size={13} weight="bold" aria-hidden="true" /> : <CaretRight size={13} weight="bold" aria-hidden="true" />}
            {t('suites.stepsCount', { count: testCase.steps.length })}
          </button>
        ) : (
          <button
            onClick={() => onEdit(testCase)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-primary transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md py-1 px-2.5 bg-canvas/40 border border-dashed border-border cursor-pointer"
            type="button"
          >
            <PencilSimple size={13} weight="bold" aria-hidden="true" />
            {t('suites.documentCase')}
          </button>
        )}

        {testCase.expectedResult && (
          <button
            onClick={() => setExpectedOpen(!expectedOpen)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-default hover:text-primary transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md py-1 px-2.5 bg-canvas/70 border border-border/70 cursor-pointer"
            aria-expanded={expectedOpen}
            type="button"
          >
            {expectedOpen ? <CaretDown size={13} weight="bold" aria-hidden="true" /> : <CaretRight size={13} weight="bold" aria-hidden="true" />}
            {t('suites.expectedResult')}
          </button>
        )}

      </div>

      {/* Expanded steps */}
      {stepsOpen && (
        <ol className="mt-2 text-sm text-default font-normal leading-relaxed space-y-1.5 list-decimal list-inside p-3.5 rounded-lg bg-canvas border border-border/70">
          {testCase.steps.map((step, i) => (
            <li key={i} className="text-default font-medium">{step}</li>
          ))}
        </ol>
      )}

      {/* Expanded expected result */}
      {expectedOpen && testCase.expectedResult && (
        <div className="mt-2 text-sm text-default font-normal bg-canvas border border-border/70 rounded-lg p-3.5 leading-relaxed">
          <p className="text-xs font-semibold text-muted mb-1">{t('suites.expectedResult')}:</p>
          <p className="font-medium text-default">{testCase.expectedResult}</p>
        </div>
      )}

    </div>
  )
}
