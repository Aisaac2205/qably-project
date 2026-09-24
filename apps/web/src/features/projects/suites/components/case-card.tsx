'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import type { TestCase } from '@qably/types'
import { PriorityBadge } from './priority-badge'
import { Translate } from '@phosphor-icons/react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/lib/i18n'
import { StatusChip } from '@/components/ui/status-chip'
import { describeCase } from '@/features/projects/suites/lib/case-title'
import { repositoryFileUrl } from '@/features/projects/suites/lib/repository-file-url'
import { CASE_HEALTH_SIGNAL_ORDER } from '@/features/projects/suites/lib/case-health-presentation'
import {
  deriveCaseAttention,
  WORKFLOW_HEALTH_SIGNALS,
} from '@/features/projects/suites/lib/case-attention'
import { CaseAttentionChip } from './case-attention-chip'
import { HealthSignalChip } from './health-signal-chip'
import { localeNameKey } from '@/features/projects/suites/lib/documentable-cases'
import { deriveCaseDocumentationBadge } from '@/features/projects/suites/lib/case-documentation-state'
import { CaseDocumentationBadge } from './case-documentation-badge'
import { CaseActionsMenu } from './case-actions-menu'
import { CaseDocumentationAction } from './case-documentation-action'
import { CaseDisclosureToggle, CaseDisclosurePanel } from './case-disclosure'

interface CaseCardProps {
  testCase: TestCase
  projectId?: string
  githubRepo?: string
  onEdit: (testCase: TestCase) => void
  onDelete: (testCase: TestCase) => void
  onImproveWithAeris?: (testCase: TestCase) => void
}

export function CaseCard({ testCase, githubRepo, onEdit, onDelete, onImproveWithAeris }: CaseCardProps) {
  const { t } = useTranslation()
  const [preconditionsOpen, setPreconditionsOpen] = useState(false)
  const [stepsOpen, setStepsOpen] = useState(false)
  const [expectedOpen, setExpectedOpen] = useState(false)
  const [observationsOpen, setObservationsOpen] = useState(false)
  const observations = testCase.observations ?? []
  const described = useMemo(() => describeCase(testCase), [testCase])
  const showRawName = described.raw !== described.title
  const staleLocale = testCase.localeStale === true
  const attention = deriveCaseAttention(testCase)
  const documentationBadge = deriveCaseDocumentationBadge(testCase)
  const qualitySignals = CASE_HEALTH_SIGNAL_ORDER.filter(
    (signal) =>
      testCase.healthSignals?.includes(signal) === true &&
      !WORKFLOW_HEALTH_SIGNALS.includes(signal),
  )
  const githubFileUrl =
    testCase.executionMode === 'automated'
      ? repositoryFileUrl(githubRepo, testCase.automationFilePath)
      : null

  return (
    <div className="py-4 px-4 sm:px-5 group bg-surface space-y-2.5">
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex-1 min-w-[200px] truncate">
          <div className="flex items-center gap-1.5 min-w-0">
            {described.path.length > 0 && (
              <span className="text-xs font-medium text-muted shrink-0">
                {described.path.join(' › ')} ›
              </span>
            )}
            <span className="text-sm font-semibold text-default truncate">
              {described.title}
            </span>
          </div>
          {(showRawName || testCase.automationFilePath) && (
            <p className="mt-0.5 font-mono text-xs text-muted truncate flex items-center gap-1">
              {showRawName && <span>{described.raw}</span>}
              {showRawName && testCase.automationFilePath && <span aria-hidden="true">·</span>}
              {testCase.automationFilePath && <span>{testCase.automationFilePath}</span>}
            </p>
          )}
          {testCase.objective && (
            <p data-testid="case-objective" className="mt-0.5 text-sm text-muted truncate">
              {testCase.objective}
            </p>
          )}
        </div>
        {githubFileUrl && (
          <Tooltip>
            <TooltipTrigger
              render={
                <a
                  href={githubFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t('suites.viewInGithub')}
                />
              }
              className="shrink-0 size-6 inline-flex items-center justify-center rounded text-muted hover:text-default hover:bg-surface-hover transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
            >
              <Image src="/logos/github.svg" alt="" width={14} height={14} aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>{t('suites.viewInGithub')}</TooltipContent>
          </Tooltip>
        )}
        <PriorityBadge priority={testCase.priority} />
        {documentationBadge !== null ? (
          <CaseDocumentationBadge badge={documentationBadge} />
        ) : attention === null || attention === 'in-review' ? (
          <StatusChip status={testCase.state} scope="lifecycle" />
        ) : (
          <CaseAttentionChip attention={attention} />
        )}

        <CaseActionsMenu
          testCase={testCase}
          onEdit={onEdit}
          onDelete={onDelete}
          onImproveWithAeris={onImproveWithAeris}
        />
      </div>

      {qualitySignals.length > 0 && (
        <div
          role="group"
          aria-label={t('quality.signals.caseAriaLabel')}
          className="flex flex-wrap items-center gap-1.5"
        >
          {qualitySignals.map((signal) => (
            <HealthSignalChip key={signal} signal={signal} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {testCase.preconditions.length > 0 && (
          <CaseDisclosureToggle
            label={t('suites.preconditionsCount', { count: testCase.preconditions.length })}
            isOpen={preconditionsOpen}
            onToggle={() => setPreconditionsOpen(!preconditionsOpen)}
          />
        )}

        <CaseDocumentationAction
          testCase={testCase}
          stepsOpen={stepsOpen}
          onToggleSteps={() => setStepsOpen(!stepsOpen)}
          documentationBadge={documentationBadge}
          onEdit={onEdit}
        />

        {staleLocale && testCase.documentedLocale && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warn rounded-md py-1 px-2.5 bg-warn-bg border border-warn/20">
            <Translate size={13} weight="bold" aria-hidden="true" />
            {t('suites.documentedInLocale', { locale: t(localeNameKey(testCase.documentedLocale)) })}
          </span>
        )}

        {testCase.expectedResult && (
          <CaseDisclosureToggle
            label={t('suites.expectedResult')}
            isOpen={expectedOpen}
            onToggle={() => setExpectedOpen(!expectedOpen)}
          />
        )}

        {observations.length > 0 && (
          <CaseDisclosureToggle
            label={t('suites.aerisObservations', { count: observations.length })}
            isOpen={observationsOpen}
            onToggle={() => setObservationsOpen(!observationsOpen)}
            tone="ai"
          />
        )}
      </div>

      <CaseDisclosurePanel isOpen={preconditionsOpen}>
        <ul className="mt-2 text-sm text-default font-normal leading-relaxed space-y-1.5 list-disc list-inside p-3.5 rounded-lg bg-canvas border border-border/70">
          {testCase.preconditions.map((precondition, i) => (
            <li key={i} className="text-default font-medium">{precondition}</li>
          ))}
        </ul>
      </CaseDisclosurePanel>

      <CaseDisclosurePanel isOpen={stepsOpen}>
        <ol className="mt-2 text-sm text-default font-normal leading-relaxed space-y-1.5 list-decimal list-inside p-3.5 rounded-lg bg-canvas border border-border/70">
          {testCase.steps.map((step, i) => (
            <li key={i} className="text-default font-medium">{step}</li>
          ))}
        </ol>
      </CaseDisclosurePanel>

      <CaseDisclosurePanel isOpen={expectedOpen && Boolean(testCase.expectedResult)}>
        <div className="mt-2 text-sm text-default font-normal bg-canvas border border-border/70 rounded-lg p-3.5 leading-relaxed">
          <p className="text-xs font-semibold text-muted mb-1">{t('suites.expectedResult')}:</p>
          <p className="font-medium text-default">{testCase.expectedResult}</p>
        </div>
      </CaseDisclosurePanel>

      <CaseDisclosurePanel isOpen={observationsOpen && observations.length > 0}>
        <ul className="mt-2 space-y-1.5 rounded-lg border border-ai/30 bg-ai-bg/30 p-3.5 text-sm leading-relaxed">
          {observations.map((observation, i) => (
            <li key={i} className="text-default font-medium">
              {observation}
            </li>
          ))}
        </ul>
      </CaseDisclosurePanel>
    </div>
  )
}
