'use client'

import { use } from 'react'
import { SuiteForm } from '@/features/projects/suites/components/suite-form'

type Params = Promise<{ id: string }>

export default function NewSuitePage({ params }: { params: Params }) {
  const { id } = use(params)
  return <SuiteForm projectId={id} />
}
