'use client'

import type { ReviewStatus } from '@qably/types'
import { StatusChip } from '@/components/ui/status-chip'

export function AiStatusChip({ status }: { status: ReviewStatus }) {
  return <StatusChip status={status} scope="review" />
}
