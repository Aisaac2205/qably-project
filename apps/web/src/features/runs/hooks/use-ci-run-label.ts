'use client'

import type { CiRunSummaryRecord } from '@qably/types'
import { useTranslation } from '@/lib/i18n'
import { ciRunLabel } from '../lib/ci-run-format'

type CiRunLabelSource = Pick<CiRunSummaryRecord, 'runNumber' | 'commitSha' | 'externalId'>

export function useCiRunLabel(ciRun: CiRunLabelSource | undefined): string | undefined {
  const { t } = useTranslation()

  if (ciRun === undefined) return undefined

  const label = ciRunLabel(ciRun)

  return label.kind === 'number' ? t('runs.ci.ciNumber', { number: label.number }) : label.value
}
