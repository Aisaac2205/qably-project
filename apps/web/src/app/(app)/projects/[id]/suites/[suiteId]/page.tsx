'use client'

import { use } from 'react'
import { SuiteDetail } from '@/features/suites/components/suite-detail'

type Params = Promise<{ id: string; suiteId: string }>

export default function SuiteDetailPage({ params }: { params: Params }) {
  const { id, suiteId } = use(params)
  return <SuiteDetail projectId={id} suiteId={suiteId} />
}
