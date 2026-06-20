'use client'

import { useOrg } from '@/lib/use-mock-store'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Buildings } from '@phosphor-icons/react'

export function OrgSection() {
  const org = useOrg()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Buildings size={20} weight="duotone" className="text-muted" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-semibold text-default">{org.name}</h3>
          <p className="text-xs text-muted">{org.slug}</p>
        </div>
        <Badge className="ml-auto capitalize">{org.plan}</Badge>
      </div>

      <Separator />

      <div>
        <h4 className="text-xs font-semibold text-default mb-3">Plan Limits</h4>
        <div className="grid grid-cols-3 gap-4">
          <LimitCard label="Max Projects" value={org.planLimits.maxProjects} />
          <LimitCard label="Max Users" value={org.planLimits.maxUsers} />
          <LimitCard label="Max Cases" value={org.planLimits.maxCases} />
        </div>
      </div>
    </div>
  )
}

function LimitCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-canvas p-3 text-center">
      <div className="text-lg font-semibold text-default font-mono">{value}</div>
      <div className="text-[10px] text-muted mt-0.5">{label}</div>
    </div>
  )
}
