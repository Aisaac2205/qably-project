'use client'

import { useState } from 'react'
import type { TestCase } from '@qably/types'
import { PriorityBadge } from './priority-badge'
import { CaretDown, CaretRight } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

const STATE_CONFIG: Record<string, { labelKey: string; className: string }> = {
  active: { labelKey: 'suites.stateActive', className: 'bg-pass-bg text-pass' },
  draft: { labelKey: 'suites.stateDraft', className: 'bg-warn-bg text-warn' },
  deprecated: { labelKey: 'suites.stateDeprecated', className: 'bg-skip-bg text-muted' },
}

export function CaseCard({ testCase }: { testCase: TestCase }) {
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
        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded ${stateConfig.className}`}>
          {t(stateConfig.labelKey)}
        </span>
      </div>

      {/* Steps */}
      <div className="mt-1">
        <button
          onClick={() => setStepsOpen(!stepsOpen)}
          className="flex items-center gap-1 text-[10px] text-muted hover:text-default transition-colors focus-visible:outline-2 focus-visible:outline-primary"
          aria-expanded={stepsOpen}
          type="button"
        >
          {stepsOpen ? <CaretDown size={10} aria-hidden="true" /> : <CaretRight size={10} aria-hidden="true" />}
          {t('suites.stepsCount', { count: testCase.steps.length })}
        </button>
        {stepsOpen && (
          <ol className="mt-1 ml-3 text-[11px] text-muted space-y-0.5 list-decimal list-inside">
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
          className="flex items-center gap-1 text-[10px] text-muted hover:text-default transition-colors focus-visible:outline-2 focus-visible:outline-primary"
          aria-expanded={expectedOpen}
          type="button"
        >
          {expectedOpen ? <CaretDown size={10} aria-hidden="true" /> : <CaretRight size={10} aria-hidden="true" />}
          {t('suites.expectedResult')}
        </button>
        {expectedOpen && (
          <p className="mt-1 ml-3 text-[11px] text-muted">
            {testCase.expectedResult}
          </p>
        )}
      </div>
    </div>
  )
}
