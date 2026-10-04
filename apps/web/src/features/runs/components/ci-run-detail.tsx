'use client'

import type { CiRunDetailRecord } from '@qably/types'
import { groupRunsByJob } from '../lib/ci-run-groups'
import { CiRunHeader } from './ci-run-header'
import { CiRunJobGroup } from './ci-run-job-group'

export function CiRunDetail({ projectId, ciRun }: { projectId: string; ciRun: CiRunDetailRecord }) {
  const { unnamed, groups } = groupRunsByJob(ciRun.runs)

  return (
    <div className="space-y-6">
      <CiRunHeader ciRun={ciRun} />
      <CiRunJobGroup projectId={projectId} ciRunExternalId={ciRun.externalId} runs={unnamed} />
      {groups.map((group) => (
        <CiRunJobGroup
          key={group.key}
          projectId={projectId}
          ciRunExternalId={ciRun.externalId}
          jobKey={group.key}
          runs={group.runs}
        />
      ))}
    </div>
  )
}
