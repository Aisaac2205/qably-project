'use client'

import Link from 'next/link'
import { useSuites } from '@/lib/use-mock-store'
import { Card, CardContent } from '@/components/ui/card'
import { SuiteRow } from './suite-row'

export function SuiteList({ projectId }: { projectId: string }) {
  const suites = useSuites(projectId)
  const sorted = [...suites].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-muted text-sm">No suites yet</p>
        <p className="text-muted text-[11px]">Create one from a project run</p>
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="p-0 divide-y divide-border">
        {sorted.map((suite) => (
          <Link
            key={suite.id}
            href={`/projects/${projectId}/suites/${suite.id}`}
            className="block focus-visible:outline-2 focus-visible:outline-primary"
          >
            <SuiteRow suite={suite} />
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
