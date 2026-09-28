'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
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
import { formatRelative } from '@/features/projects/suites/lib/format-relative'

interface CaseCardProps {
  testCase: TestCase
  projectId?: string
  githubRepo?: string
  onEdit: (testCase: TestCase) => void
  onDelete: (testCase: TestCase) => void
  onImproveWithAeris?: (testCase: TestCase) => void
}

export function CaseCard({ testCase, projectId, githubRepo, onEdit, onDelete, onImproveWithAeris }: CaseCardProps) {
  const { t, locale } = useTranslation()
  const [preconditionsOpen, setPreconditionsOpen] = useState(false)
  const [stepsOpen, setStepsOpen] = useState(false)
  const [expectedOpen, setExpectedOpen] = useState(false)
  const [observationsOpen, setObservationsOpen] = useState(false)
  const observations = testCase.observations ?? []
  const described = useMemo(() => describeCase(testCase), [testCase])
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
    <div className="py-3.5 px-4 sm:px-5 group bg-surface space-y-2.5" data-testid={`case-row-${testCase.id}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-default leading-snug text-pretty line-clamp-2">
            {described.title}
          </p>
          {testCase.objective && (
            <p data-testid="case-objective" className="mt-0.5 text-sm text-muted leading-snug line-clamp-2">
              {testCase.objective}
            </p>
          )}
          {testCase.automationFilePath && (
            <div className="mt-1.5 flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted">
              {githubFileUrl ? (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <a
                        href={githubFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={testCase.automationFilePath}
                      />
                    }
                    className="inline-flex min-w-0 shrink basis-auto items-center gap-1 truncate text-muted transition-colors duration-150 hover:text-default outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-sm"
                  >
                    <Image
                      src="/logos/github.svg"
                      alt=""
                      width={12}
                      height={12}
                      aria-hidden="true"
                      className="shrink-0"
                    />
                    {testCase.automationFilePath}
                  </TooltipTrigger>
                  <TooltipContent>{t('suites.viewInGithub')}</TooltipContent>
                </Tooltip>
              ) : (
                <span
                  className="min-w-0 shrink basis-auto truncate"
                  title={testCase.automationFilePath}
                >
                  {testCase.automationFilePath}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:max-w-1/2 sm:shrink-0 sm:justify-end">
          <PriorityBadge priority={testCase.priority} />
          {testCase.lastResult && (
            <span className="flex items-center gap-1.5">
              <StatusChip status={testCase.lastResult.status} />
              {projectId && testCase.lastResult.commitSha ? (
                <Link
                  href={`/projects/${projectId}/runs/${testCase.lastResult.runId}`}
                  className="font-mono text-xs text-muted transition-colors hover:text-default hover:underline focus-visible:outline-2 focus-visible:outline-primary rounded-sm"
                  title={t('suites.lastResult')}
                >
                  {testCase.lastResult.commitSha.slice(0, 7)}
                </Link>
              ) : (
                <span className="text-xs text-muted">
                  {formatRelative(testCase.lastResult.recordedAt, locale, t('suites.never'))}
                </span>
              )}
            </span>
          )}
          {documentationBadge !== null ? (
            <CaseDocumentationBadge badge={documentationBadge} />
          ) : attention !== null && attention !== 'in-review' ? (
            <CaseAttentionChip attention={attention} />
          ) : testCase.state !== 'active' ? (
            <StatusChip status={testCase.state} scope="lifecycle" />
          ) : null}

          <CaseActionsMenu
            testCase={testCase}
            onEdit={onEdit}
            onDelete={onDelete}
            onImproveWithAeris={onImproveWithAeris}
          />
        </div>
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
