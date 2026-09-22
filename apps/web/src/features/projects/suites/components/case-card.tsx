'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import type { TestCase } from '@qably/types'
import { PriorityBadge } from './priority-badge'
import { CaretDown, CaretRight, ChatCircleText, Clock, DotsThree, PencilSimple, Sparkle, Trash, Translate } from '@phosphor-icons/react'
import { Menu, MenuContent, MenuItem, MenuPortal, MenuPositioner, MenuTrigger } from '@/components/ui/menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from '@/lib/i18n'
import { useDocumentCase } from '@/features/projects/suites/hooks/use-suite-mutations'
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
  const documentCase = useDocumentCase()
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
                {testCase.executionMode === 'automated' && (
                  <MenuItem
                    onClick={() =>
                      documentCase.mutate({ suiteId: testCase.suiteId, caseId: testCase.id })
                    }
                    className="text-ai data-[highlighted]:bg-ai-bg data-[highlighted]:text-ai"
                  >
                    <Sparkle size={14} aria-hidden="true" />
                    {t('suites.redocumentCase')}
                  </MenuItem>
                )}
                {onImproveWithAeris && (
                  <MenuItem
                    onClick={() => onImproveWithAeris(testCase)}
                    className="text-ai data-[highlighted]:bg-ai-bg data-[highlighted]:text-ai"
                  >
                    <ChatCircleText size={14} aria-hidden="true" />
                    {t('aiReview.improveWithAeris')}
                  </MenuItem>
                )}
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

      {/* Preconditions, Steps, Expected result, & Traceability toggles */}
      <div className="flex flex-wrap items-center gap-2">
        {testCase.preconditions.length > 0 && (
          <button
            onClick={() => setPreconditionsOpen(!preconditionsOpen)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-default hover:text-primary transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md py-1 px-2.5 bg-canvas/70 border border-border/70 cursor-pointer"
            aria-expanded={preconditionsOpen}
            type="button"
          >
            {preconditionsOpen ? <CaretDown size={13} weight="bold" aria-hidden="true" /> : <CaretRight size={13} weight="bold" aria-hidden="true" />}
            {t('suites.preconditionsCount', { count: testCase.preconditions.length })}
          </button>
        )}

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
        ) : testCase.executionMode === 'automated' ? (
          documentationBadge === null && testCase.pendingProposalId ? (
            <Link
              href={`/review-inbox?proposal=${testCase.pendingProposalId}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-ai hover:text-ai transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md py-1 px-2.5 bg-ai-bg/40 border border-dashed border-ai/40"
            >
              <Clock size={13} weight="bold" aria-hidden="true" />
              {t('suites.caseInReview')}
            </Link>
          ) : null
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

        {staleLocale && testCase.documentedLocale && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-warn rounded-md py-1 px-2.5 bg-warn-bg border border-warn/20">
            <Translate size={13} weight="bold" aria-hidden="true" />
            {t('suites.documentedInLocale', { locale: t(localeNameKey(testCase.documentedLocale)) })}
          </span>
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

        {observations.length > 0 && (
          <button
            onClick={() => setObservationsOpen(!observationsOpen)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ai hover:text-ai transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md py-1 px-2.5 bg-ai-bg/40 border border-ai/30 cursor-pointer"
            aria-expanded={observationsOpen}
            type="button"
          >
            {observationsOpen ? <CaretDown size={13} weight="bold" aria-hidden="true" /> : <CaretRight size={13} weight="bold" aria-hidden="true" />}
            {t('suites.aerisObservations', { count: observations.length })}
          </button>
        )}

      </div>

      {/* Expanded preconditions */}
      {preconditionsOpen && (
        <ul className="mt-2 text-sm text-default font-normal leading-relaxed space-y-1.5 list-disc list-inside p-3.5 rounded-lg bg-canvas border border-border/70">
          {testCase.preconditions.map((precondition, i) => (
            <li key={i} className="text-default font-medium">{precondition}</li>
          ))}
        </ul>
      )}

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

      {/* Expanded Aeris observations */}
      {observationsOpen && observations.length > 0 && (
        <ul className="mt-2 space-y-1.5 rounded-lg border border-ai/30 bg-ai-bg/30 p-3.5 text-sm leading-relaxed">
          {observations.map((observation, i) => (
            <li key={i} className="text-default font-medium">
              {observation}
            </li>
          ))}
        </ul>
      )}

    </div>
  )
}
