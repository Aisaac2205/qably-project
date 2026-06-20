'use client'

import { use } from 'react'
import { SuiteList } from '@/features/suites/components/suite-list'
import Link from 'next/link'

type Params = Promise<{ id: string }>

export default function SuitesPage({ params }: { params: Params }) {
  const { id } = use(params)
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-default">Suites</h1>
      </div>
      <SuiteList projectId={id} />
    </div>
  )
}
