'use client'

import { use } from 'react'
import { CaseForm } from '@/features/projects/suites/components/case-form'

type Params = Promise<{ id: string; suiteId: string }>

export default function NewCasePage({ params }: { params: Params }) {
  const { id, suiteId } = use(params)
  return <CaseForm projectId={id} suiteId={suiteId} />
}
