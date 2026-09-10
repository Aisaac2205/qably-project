'use client'

import Link from 'next/link'
import type { SuiteProposal } from '@qably/types'
import { Check, LockSimple, X } from '@phosphor-icons/react'
import { AerisIcon } from '@/components/icons/aeris-icon'
import { useTranslation } from '@/lib/i18n'

interface SuiteProposalsPanelProps {
  proposals: SuiteProposal[]
  isDeciding: boolean
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

const DECISION_CLASS =
  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60'

export function SuiteProposalsPanel({
  proposals,
  isDeciding,
  onApprove,
  onReject,
}: SuiteProposalsPanelProps) {
  const { t } = useTranslation()

  if (proposals.length === 0) return null

  return (
    <section
      aria-labelledby="suite-proposals-heading"
      className="rounded-xl border border-ai/30 bg-ai-bg/20 p-4 space-y-3"
    >
      <div className="flex items-center gap-2">
        <AerisIcon size={14} />
        <h2 id="suite-proposals-heading" className="text-sm font-semibold text-default">
          {t('reviewInbox.suiteProposalsTitle', { count: proposals.length })}
        </h2>
      </div>
      <ul className="space-y-2">
        {proposals.map((proposal) => {
          const protectedName = proposal.suiteNameSource === 'human'
          return (
            <li
              key={proposal.id}
              className="rounded-lg border border-border bg-surface p-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-xs text-muted">
                  {t('reviewInbox.suiteProposalCurrentName')}{' '}
                  <Link
                    href={`/projects/${proposal.projectId}/suites/${proposal.suiteId}`}
                    className="font-mono text-default hover:text-primary hover:underline"
                  >
                    {proposal.suiteName}
                  </Link>
                </p>
                <p className="text-sm font-semibold text-default">{proposal.title}</p>
                <p className="text-sm text-muted text-wrap-pretty">{proposal.description}</p>
                {protectedName && (
                  <p className="flex items-center gap-1.5 text-xs text-warn">
                    <LockSimple size={12} weight="bold" aria-hidden="true" />
                    {t('reviewInbox.suiteProposalHumanNamed')}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={isDeciding}
                  onClick={() => onApprove(proposal.id)}
                  className={`${DECISION_CLASS} border-pass/40 text-pass hover:bg-pass-bg/40`}
                >
                  <Check size={13} weight="bold" aria-hidden="true" />
                  {t('reviewInbox.suiteProposalApprove')}
                </button>
                <button
                  type="button"
                  disabled={isDeciding}
                  onClick={() => onReject(proposal.id)}
                  className={`${DECISION_CLASS} border-border text-muted hover:text-fail hover:border-fail/40`}
                >
                  <X size={13} weight="bold" aria-hidden="true" />
                  {t('reviewInbox.suiteProposalReject')}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
