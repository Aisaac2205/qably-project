'use client'

import { useState } from 'react'
import { RunProgressHeader } from '@/components/runs/run-progress-header'
import { CaseList } from '@/components/runs/case-list'
import { CaseDetail } from '@/components/runs/case-detail'
import { mockRun } from '@/lib/mock-data'
import type { CaseStatus } from '@/lib/mock-data'

type Verdict = 'pass' | 'fail' | 'skip' | 'blocked'

export default function RunPage() {
  const [cases, setCases] = useState(mockRun.cases)
  const [activeId, setActiveId] = useState(mockRun.cases[0].id)

  const activeCase = cases.find(c => c.id === activeId) ?? cases[0]

  function handleVerdict(verdict: Verdict) {
    setCases(prev =>
      prev.map(c => (c.id === activeId ? { ...c, status: verdict as CaseStatus } : c))
    )
    const currentIdx = cases.findIndex(c => c.id === activeId)
    const next = cases.slice(currentIdx + 1).find(c => c.status === 'pending' || c.status === 'running')
    if (next) setActiveId(next.id)
  }

  return (
    <div className="flex flex-col h-full">
      <RunProgressHeader cases={cases} />
      <div className="flex flex-1 overflow-hidden">
        <CaseList cases={cases} activeId={activeId} onSelect={setActiveId} />
        <CaseDetail testCase={activeCase} onVerdict={handleVerdict} />
      </div>
    </div>
  )
}
