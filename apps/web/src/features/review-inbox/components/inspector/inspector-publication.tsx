'use client'

import Link from 'next/link'
import {
  ListChecks,
  GitCommit,
  GitPullRequest,
  FileText,
  CalendarCheck,
} from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import { formatRelative } from '@/features/projects/suites/lib/format-relative'
import { suiteEditCasePath } from '@/features/projects/lib/routes'
import { getExecutionStatusPresentation, statusToneClassNames } from '@/components/ui/status-presentation'
import { cn } from '@/lib/utils'
import type {
  MatchedCaseView,
  ProposalSourceView,
  RecentRunView,
  LastDecisionView,
  PublishedVersionView,
} from '../../api/review.api'

interface InspectorPublicationProps {
  projectId: string
  matchedCase: MatchedCaseView | null
  source: ProposalSourceView | null
  recentRuns: RecentRunView[]
  decision: LastDecisionView | null
  publishedVersion: PublishedVersionView | null
}

export function InspectorPublication({
  projectId,
  matchedCase,
  source,
  recentRuns,
  decision,
  publishedVersion,
}: InspectorPublicationProps) {
  const { t, locale } = useTranslation()

  const hasAnyContent =
    matchedCase !== null ||
    source !== null ||
    recentRuns.length > 0 ||
    decision !== null ||
    publishedVersion !== null

  if (!hasAnyContent) return null

  return (
    <div className="space-y-4 border-t border-border/80 pt-6">
      {matchedCase && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <ListChecks size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
            <h4 className="text-xs sm:text-sm font-semibold text-default">
              {t('reviewInbox.matchedCaseHeading')}
            </h4>
          </div>
          <Link
            href={suiteEditCasePath(projectId, matchedCase.suiteId, matchedCase.id)}
            className="ml-6 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            {matchedCase.name}
            <span className="text-muted">· {matchedCase.suiteName}</span>
          </Link>
        </div>
      )}

      {source && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <FileText size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
            <h4 className="text-xs sm:text-sm font-semibold text-default">
              {t('reviewInbox.sourceHeading')}
            </h4>
          </div>
          <div className="ml-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-default">
            <span className="font-mono">{source.filePath}</span>
            {source.commitSha && (
              <span className="inline-flex items-center gap-1 text-muted">
                <GitCommit size={14} aria-hidden="true" />
                {t('reviewInbox.sourceCommit', { sha: source.commitSha.slice(0, 7) })}
              </span>
            )}
            {source.pullRequestNumber !== null && (
              <span className="inline-flex items-center gap-1 text-muted">
                <GitPullRequest size={14} aria-hidden="true" />
                {t('reviewInbox.sourcePullRequest', { number: source.pullRequestNumber })}
              </span>
            )}
          </div>
        </div>
      )}

      {matchedCase && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <CalendarCheck size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
            <h4 className="text-xs sm:text-sm font-semibold text-default">
              {t('reviewInbox.recentRunsHeading')}
            </h4>
          </div>
          {recentRuns.length === 0 ? (
            <p className="ml-6 text-sm text-muted">{t('reviewInbox.noRecentRuns')}</p>
          ) : (
            <ul className="ml-6 space-y-1">
              {recentRuns.map((run) => {
                const presentation = getExecutionStatusPresentation(run.status)
                const RunIcon = presentation.Icon
                return (
                  <li key={run.runId} className="flex items-center gap-2 text-sm text-default">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                        statusToneClassNames[presentation.tone],
                      )}
                    >
                      <RunIcon size={12} weight="fill" aria-hidden="true" />
                      {t(presentation.labelKey)}
                    </span>
                    <span className="text-muted">{formatRelative(run.recordedAt, locale, '')}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {(publishedVersion || decision) && (
        <p className="ml-6 text-xs text-muted">
          {publishedVersion &&
            (publishedVersion.publishedBy
              ? t('reviewInbox.publishedByKnown', {
                  name: publishedVersion.publishedBy.name,
                  time: formatRelative(publishedVersion.publishedAt, locale, ''),
                })
              : t('reviewInbox.publishedByUnknown', {
                  time: formatRelative(publishedVersion.publishedAt, locale, ''),
                }))}
          {!publishedVersion &&
            decision &&
            t(
              decision.action === 'approved'
                ? 'reviewInbox.decidedByApproved'
                : 'reviewInbox.decidedByRejected',
              { name: decision.decidedBy.name, time: formatRelative(decision.decidedAt, locale, '') },
            )}
        </p>
      )}
    </div>
  )
}
