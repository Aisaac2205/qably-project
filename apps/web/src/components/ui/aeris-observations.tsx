'use client'

import { AerisIcon } from '@/components/icons/aeris-icon'
import { useTranslation } from '@/lib/i18n'

export function AerisObservations({ observations }: { observations?: string[] }) {
  const { t } = useTranslation()

  if (observations === undefined || observations.length === 0) return null

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <AerisIcon size={16} />
        <h4 className="text-xs sm:text-sm font-semibold text-default">
          {t('reviewInbox.aerisObservations')}
        </h4>
      </div>
      <ul className="ml-6 rounded-xl border border-ai/30 bg-ai-bg/20 p-4 text-sm text-default leading-relaxed space-y-1.5 list-disc list-inside">
        {observations.map((observation, index) => (
          <li key={index}>{observation}</li>
        ))}
      </ul>
    </div>
  )
}
