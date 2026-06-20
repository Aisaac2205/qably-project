'use client'

import type { Suite } from '@qably/types'
import { InlineEditableText } from './inline-editable-text'
import { updateSuite } from '@/lib/mock-store'

interface SuiteRowProps {
  suite: Suite
}

export function SuiteRow({ suite }: SuiteRowProps) {
  function handleSave(newName: string) {
    updateSuite(suite.id, { name: newName })
  }

  const caseCount = suite.cases.length
  const created = new Date(suite.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-canvas transition-colors rounded group">
      <div className="min-w-0 flex-1">
        <InlineEditableText
          value={suite.name}
          onSave={handleSave}
          ariaLabel={`Edit suite name: ${suite.name}`}
        />
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-[10px] text-muted">
            <span className="font-semibold text-default">{caseCount}</span> cases
          </span>
          <span className="text-[10px] text-muted">
            {created}
          </span>
        </div>
      </div>
    </div>
  )
}
