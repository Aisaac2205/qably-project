'use client'

import { ShieldCheck, GitBranch, Sparkle, UserCheck, CheckCircle } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export function ReviewGovernanceBanner() {
  const { t } = useTranslation()

  return (
    <section
      aria-labelledby="review-governance-heading"
      className="rounded-xl border border-border bg-surface p-5 shadow-xs md:p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-ai-bg text-ai">
              <ShieldCheck size={16} weight="fill" aria-hidden="true" />
            </span>
            <h2 id="review-governance-heading" className="text-base font-semibold tracking-[-0.015em] text-default">
              {t('reviewInbox.governanceTitle')}
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-muted text-wrap-pretty">
            {t('reviewInbox.governanceSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-canvas/60 px-2.5 py-1.5 text-muted">
            <GitBranch size={14} aria-hidden="true" />
            <span>01 SCM</span>
          </div>
          <span className="text-muted/60" aria-hidden="true">→</span>
          <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-canvas/60 px-2.5 py-1.5 text-muted">
            <Sparkle size={14} weight="fill" className="text-ai" aria-hidden="true" />
            <span>02 AI Extraction</span>
          </div>
          <span className="text-muted/60" aria-hidden="true">→</span>
          <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1.5 font-semibold text-primary shadow-xs">
            <UserCheck size={14} weight="bold" aria-hidden="true" />
            <span>03 Human Review</span>
          </div>
          <span className="text-muted/60" aria-hidden="true">→</span>
          <div className="flex items-center gap-1.5 rounded-lg border border-border/80 bg-canvas/60 px-2.5 py-1.5 text-muted">
            <CheckCircle size={14} weight="fill" className="text-pass" aria-hidden="true" />
            <span>04 Official Case</span>
          </div>
        </div>
      </div>
    </section>
  )
}
