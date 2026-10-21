'use client'

import { CircleNotch } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

/**
 * Shown while Aeris documents the case this proposal would update. Approving
 * now wins: the queued run sees its claim on the case cleared and skips it.
 * The inspector refetches the detail while this shows, so it clears when the
 * run finishes.
 */
export function CaseDocumentingNotice() {
  const { t } = useTranslation()

  return (
    <div
      role="note"
      className="flex items-start gap-2.5 rounded-xl border border-ai/30 bg-ai-bg/50 px-4 py-3"
    >
      <CircleNotch
        size={14}
        weight="bold"
        className="mt-0.5 shrink-0 text-ai animate-spin motion-reduce:animate-none"
        aria-hidden="true"
      />
      <p className="text-sm text-default leading-relaxed text-pretty">
        {t('reviewInbox.caseDocumentingNotice')}
      </p>
    </div>
  )
}
