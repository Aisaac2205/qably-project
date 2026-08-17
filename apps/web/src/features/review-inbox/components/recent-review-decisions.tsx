'use client'

import { ShieldCheck, CheckCircle, XCircle, Clock } from '@phosphor-icons/react'
import { useReviewDecisions, useProposals } from '@/lib/use-mock-store'
import { useTranslation } from '@/lib/i18n'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export function RecentReviewDecisions() {
  const decisions = useReviewDecisions()
  const proposals = useProposals()
  const { t } = useTranslation()

  const proposalMap = new Map(proposals.map((p) => [p.id, p]))
  const recentDecisions = [...decisions].reverse().slice(0, 5)

  return (
    <Card className="rounded-xl border border-border/80 bg-surface shadow-card flex flex-col justify-between">
      <CardHeader className="flex flex-row items-center justify-between p-5 pb-3">
        <div className="space-y-0.5">
          <CardTitle className="text-sm font-semibold text-default flex items-center gap-2">
            <ShieldCheck size={16} weight="fill" className="text-muted" aria-hidden="true" />
            {t('reviewInbox.recentDecisionsTitle')}
          </CardTitle>
          <p className="text-xs text-muted">
            {t('reviewInbox.recentDecisionsSubtitle')}
          </p>
        </div>
      </CardHeader>

      <CardContent className="p-5 pt-0 flex-1">
        {recentDecisions.length === 0 ? (
          <div className="flex min-h-28 flex-col items-center justify-center text-center p-4">
            <Clock size={24} className="text-muted mb-2" aria-hidden="true" />
            <p className="text-xs text-muted">
              {t('reviewInbox.noDecisionsYet')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {recentDecisions.map((decision) => {
              const proposal = proposalMap.get(decision.proposalId)
              const isApproved = decision.action === 'approved'

              return (
                <div
                  key={decision.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-0 text-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded ${
                        isApproved ? 'bg-pass-bg text-pass' : 'bg-fail-bg text-fail'
                      }`}
                    >
                      {isApproved ? (
                        <CheckCircle size={13} weight="fill" aria-hidden="true" />
                      ) : (
                        <XCircle size={13} weight="fill" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-default truncate">
                        {proposal?.title || decision.proposalId}
                      </p>
                      <p className="text-muted truncate text-[11px]">
                        <span>{decision.actorId}</span>
                        {decision.comment && <span> · {decision.comment}</span>}
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 font-mono text-[11px] text-muted">
                    {new Date(decision.decidedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
