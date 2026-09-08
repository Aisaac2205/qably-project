'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { TestCase } from '@qably/types'
import { PriorityBadge } from './priority-badge'
import { CaretDown, CaretRight, DotsThree, PencilSimple, Sparkle, Trash } from '@phosphor-icons/react'
import { Menu, MenuContent, MenuItem, MenuPortal, MenuPositioner, MenuTrigger } from '@/components/ui/menu'
import { useTranslation } from '@/lib/i18n'
import { StatusChip } from '@/components/ui/status-chip'
import { ExecutionModeBadge } from '@/components/ui/execution-mode-badge'
import { describeCase } from '@/features/projects/suites/lib/case-title'
import { useDocumentCase } from '@/features/projects/suites/hooks/use-suite-mutations'
import { ApiError } from '@/lib/api-client'
import { projectAiReviewPath } from '@/features/projects/lib/routes'

function documentCaseErrorKey(error: unknown): string {
  if (!(error instanceof ApiError)) return 'suites.documentCaseError'
  switch (error.code) {
    case 'ai-not-enabled':
      return 'suites.documentCaseAiDisabled'
    case 'not-found':
      return 'suites.documentCaseNotFound'
    case 'not-automated':
      return 'suites.documentCaseNotAutomated'
    case 'already-pending':
      return 'suites.documentCaseAlreadyPending'
  }
  if (error.status === 404) return 'suites.documentCaseNotFound'
  if (error.status === 409) return 'suites.documentCaseConflict'
  if (error.status === 429) return 'suites.documentCaseThrottled'
  return 'suites.documentCaseError'
}

interface CaseCardProps {
  testCase: TestCase
  projectId?: string
  onEdit: (testCase: TestCase) => void
  onDelete: (testCase: TestCase) => void
}

export function CaseCard({ testCase, projectId, onEdit, onDelete }: CaseCardProps) {
  const { t } = useTranslation()
  const [stepsOpen, setStepsOpen] = useState(false)
  const [expectedOpen, setExpectedOpen] = useState(false)
  const described = useMemo(() => describeCase(testCase), [testCase])
  const showRawName = described.raw !== described.title
  const documentation = useDocumentCase()

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
        </div>
        {testCase.version !== null && (
          <span className="shrink-0 whitespace-nowrap rounded bg-canvas border border-border px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted">
            v{testCase.version}
          </span>
        )}
        <ExecutionModeBadge mode={testCase.executionMode} />
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
        ) : testCase.executionMode === 'automated' ? (
          documentation.isSuccess ? null : (
            <button
              onClick={() => documentation.mutate({ suiteId: testCase.suiteId, caseId: testCase.id })}
              disabled={documentation.isPending}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-ai hover:text-ai transition-colors outline-none focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-md py-1 px-2.5 bg-ai-bg/40 border border-dashed border-ai/40 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
              type="button"
            >
              <Sparkle size={13} weight="bold" aria-hidden="true" />
              {documentation.isPending ? t('suites.documentingCase') : t('suites.documentWithAi')}
            </button>
          )
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

      {documentation.isSuccess && (
        <p role="status" className="text-xs text-ai flex items-center gap-1.5">
          {t('suites.documentCaseQueued')}
          {projectId && (
            <Link href={projectAiReviewPath(projectId)} className="font-semibold underline hover:text-primary">
              {t('suites.viewInAiReview')}
            </Link>
          )}
        </p>
      )}

      {documentation.isError && (
        <p role="alert" className="text-xs text-fail">
          {t(documentCaseErrorKey(documentation.error))}
        </p>
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

    </div>
  )
}
