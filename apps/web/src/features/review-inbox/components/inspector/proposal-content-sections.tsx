'use client'

import type { ExtractedProposal } from '@qably/types'
import { Target, ClipboardText, ListNumbers, CheckCircle, GitDiff } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import type { PublishedVersionView } from '../../api/review.api'
import { diffAgainstPublishedVersion } from '../../lib/diff-published-version'

interface ProposalContentSectionsProps {
  proposal: ExtractedProposal
  needsManualReview: boolean
  publishedVersion?: PublishedVersionView | null
}

export function ProposalContentSections({
  proposal,
  needsManualReview,
  publishedVersion = null,
}: ProposalContentSectionsProps) {
  const { t } = useTranslation()
  const diff = diffAgainstPublishedVersion(proposal, publishedVersion)

  return (
    <>
      {diff && (
        <div className="space-y-2.5 rounded-xl border border-border/80 bg-canvas/40 p-4">
          <div className="flex items-center gap-2">
            <GitDiff size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
            <h4 className="text-xs sm:text-sm font-semibold text-default">
              {t('reviewInbox.diffHeading', { version: publishedVersion?.version ?? 0 })}
            </h4>
          </div>

          {!diff.hasChanges && (
            <p className="text-sm text-muted pl-6">{t('reviewInbox.diffNoChanges')}</p>
          )}

          {diff.scalarChanges.map((change) => (
            <div key={change.field} className="pl-6 text-sm leading-relaxed">
              <p className="text-xs font-semibold text-default">{t(`reviewInbox.diffField_${change.field}`)}</p>
              <p>
                <del className="text-fail decoration-fail">{change.previous}</del>
              </p>
              <p>
                <ins className="text-pass decoration-pass no-underline font-medium">{change.next}</ins>
              </p>
            </div>
          ))}

          {diff.listChanges.map((change) => (
            <div key={change.field} className="pl-6 text-sm leading-relaxed space-y-1">
              <p className="text-xs font-semibold text-default">{t(`reviewInbox.diffField_${change.field}`)}</p>
              {change.removed.length > 0 && (
                <p>
                  <span className="text-xs font-semibold text-fail">{t('reviewInbox.diffRemoved')}: </span>
                  {change.removed.map((item, idx) => (
                    <del key={idx} className="mr-2 text-fail decoration-fail">
                      {item}
                    </del>
                  ))}
                </p>
              )}
              {change.added.length > 0 && (
                <p>
                  <span className="text-xs font-semibold text-pass">{t('reviewInbox.diffAdded')}: </span>
                  {change.added.map((item, idx) => (
                    <ins key={idx} className="mr-2 text-pass decoration-pass no-underline font-medium">
                      {item}
                    </ins>
                  ))}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {!needsManualReview && proposal.objective && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Target size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
            <h4 className="text-xs sm:text-sm font-semibold text-default">
              {t('reviewInbox.objective')}
            </h4>
          </div>
          <p className="text-sm text-default/90 leading-relaxed pl-6">{proposal.objective}</p>
        </div>
      )}

      {proposal.preconditions && proposal.preconditions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <ClipboardText
              size={16}
              weight="bold"
              className="text-muted shrink-0"
              aria-hidden="true"
            />
            <h4 className="text-xs sm:text-sm font-semibold text-default">
              {t('reviewInbox.preconditions')}
            </h4>
          </div>
          <ul className="list-disc list-inside space-y-1 text-sm text-default/90 pl-6 leading-relaxed">
            {proposal.preconditions.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {proposal.steps.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <ListNumbers
              size={16}
              weight="bold"
              className="text-muted shrink-0"
              aria-hidden="true"
            />
            <h4 className="text-xs sm:text-sm font-semibold text-default">
              {t('reviewInbox.steps')}
            </h4>
          </div>
          <ol className="space-y-2 pl-6">
            {proposal.steps.map((step, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border border-border/70 bg-canvas/30 p-3 text-sm text-default leading-relaxed"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-border/60 font-mono text-xs font-semibold text-muted">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {proposal.expectedResult !== '' && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle
              size={16}
              weight="bold"
              className="text-muted shrink-0"
              aria-hidden="true"
            />
            <h4 className="text-xs sm:text-sm font-semibold text-default">
              {t('reviewInbox.expectedResult')}
            </h4>
          </div>
          <div className="ml-6 rounded-xl border border-border/80 bg-canvas/40 p-4 text-sm text-default leading-relaxed">
            {proposal.expectedResult}
          </div>
        </div>
      )}
    </>
  )
}
