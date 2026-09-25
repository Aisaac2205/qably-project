'use client'

import type { Evidence, TraceabilityLink } from '@qably/types'
import { Paperclip } from '@phosphor-icons/react'
import { EvidenceExcerpt } from '@/features/review-inbox/components/evidence-excerpt'
import { EvidenceList } from '@/components/ui/evidence-list'
import { TraceabilityTrail } from '@/components/ui/traceability-trail'
import { AerisObservations } from '@/components/ui/aeris-observations'
import { useTranslation } from '@/lib/i18n'

interface InspectorEvidenceProps {
  observations: string[] | undefined
  evidence: Evidence | undefined
  links: TraceabilityLink[]
}

export function InspectorEvidence({ observations, evidence, links }: InspectorEvidenceProps) {
  const { t } = useTranslation()

  return (
    <>
      <AerisObservations observations={observations} />

      {evidence && <EvidenceExcerpt evidence={evidence} />}

      {evidence && (
        <div className="space-y-3 border-t border-border/80 pt-6">
          <div className="flex items-center gap-2">
            <Paperclip size={16} weight="bold" className="text-muted shrink-0" aria-hidden="true" />
            <h4 className="text-xs sm:text-sm font-semibold text-default">
              {t('reviewInbox.evidenceHeading')}
            </h4>
          </div>
          <div className="ml-6 space-y-4">
            <EvidenceList evidence={[evidence]} />
            {links.length > 0 && <TraceabilityTrail links={links} />}
          </div>
        </div>
      )}
    </>
  )
}
