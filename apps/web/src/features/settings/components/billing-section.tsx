'use client'

import { useOrg } from '@/lib/use-mock-store'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Lightning, CheckCircle } from '@phosphor-icons/react'

const STARTER_FEATURES = [
  'Up to 5 projects',
  'Up to 10 team members',
  'Up to 1,000 AI-generated cases',
  'GitHub integration',
  'Basic reporting',
]

const PRO_FEATURES = [
  'Unlimited projects',
  'Unlimited team members',
  'Unlimited AI cases',
  'Priority support',
  'Advanced analytics',
  'SSO / SAML',
]

export function BillingSection() {
  const org = useOrg()

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Current plan */}
      <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-default">Current plan</h3>
              <p className="text-xs text-muted mt-0.5">Billed monthly · Renews Dec 12, 2026</p>
            </div>
            <Badge className="capitalize">{org.plan}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <UsageStat label="Projects" used={2} max={org.planLimits.maxProjects} />
            <UsageStat label="Members" used={4} max={org.planLimits.maxUsers} />
            <UsageStat label="Cases" used={312} max={org.planLimits.maxCases} />
          </div>
          <Separator className="mb-4" />
          <div className="space-y-1.5">
            {STARTER_FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-2 text-xs text-muted">
                <CheckCircle size={13} weight="fill" className="text-pass shrink-0" aria-hidden="true" />
                {f}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upgrade CTA */}
      <Card className="border-primary/30 bg-primary/[0.03]">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Lightning size={18} weight="duotone" className="text-primary" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-default">Upgrade to Pro</h4>
              <p className="text-xs text-muted mt-0.5 mb-3">
                Remove limits and unlock advanced features for your entire team.
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-4">
                {PRO_FEATURES.map((f) => (
                  <div key={f} className="flex items-center gap-1.5 text-xs text-muted">
                    <CheckCircle size={12} weight="fill" className="text-primary shrink-0" aria-hidden="true" />
                    {f}
                  </div>
                ))}
              </div>
              <Button size="sm" className="gap-1.5">
                <Lightning size={14} weight="fill" aria-hidden="true" />
                Upgrade to Pro
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function UsageStat({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / max) * 100))
  const isHigh = pct >= 80

  return (
    <div className="rounded-lg border border-border bg-canvas p-3">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-xs font-mono text-muted tabular-nums">
          {used}/{max >= 1000 ? `${Math.round(max / 1000)}k` : max}
        </span>
      </div>
      <div className="h-1 rounded-full bg-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isHigh ? 'bg-warn' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={used}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={`${label}: ${used} of ${max}`}
        />
      </div>
    </div>
  )
}
