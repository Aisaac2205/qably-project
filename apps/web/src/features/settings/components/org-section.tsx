'use client'

import type { ReactNode } from 'react'
import { useOrg } from '@/lib/use-mock-store'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Buildings,
  UserPlus,
  Key,
  CurrencyDollar,
  Plug,
  CaretRight,
  CheckCircle,
} from '@phosphor-icons/react'
import type { ElementType } from 'react'
type TabValue = 'general' | 'members' | 'api-keys' | 'integrations' | 'billing'

interface OrgSectionProps {
  onNavigate?: (tab: TabValue) => void
}

const QUICK_ACTIONS: Array<{
  icon: ElementType
  label: string
  description: string
  tab: TabValue
}> = [
  {
    icon: UserPlus,
    label: 'Invite members',
    description: 'Invite and manage team permissions',
    tab: 'members',
  },
  {
    icon: Key,
    label: 'Generate API key',
    description: 'Create access tokens for integrations',
    tab: 'api-keys',
  },
  {
    icon: CurrencyDollar,
    label: 'Data billing',
    description: 'Review usage and update billing',
    tab: 'billing',
  },
  {
    icon: Plug,
    label: 'Configure integrations',
    description: 'Connect your services and tools',
    tab: 'integrations',
  },
]


const TEST_FRAMEWORKS = ['Playwright', 'Cypress', 'Vitest', 'Jest']

export function OrgSection({ onNavigate = () => {} }: OrgSectionProps) {
  const org = useOrg()

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* Left panel — overview + quick actions */}
      <div className="xl:col-span-3 space-y-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <Buildings size={22} weight="duotone" className="text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-default">{org.name}</h3>
                  <Badge className="capitalize">{org.plan}</Badge>
                </div>
                <p className="text-xs text-muted mt-0.5">{org.slug}</p>
                <p className="text-xs text-muted mt-2">Manage your organization, settings and tools</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <h4 className="text-sm font-semibold text-default mb-3">Quick actions</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.tab}
                onClick={() => onNavigate(action.tab)}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface hover:bg-canvas transition-colors text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <action.icon size={15} weight="duotone" className="text-primary" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-default">{action.label}</div>
                  <div className="text-xs text-muted mt-0.5 leading-snug">{action.description}</div>
                </div>
                <CaretRight
                  size={13}
                  className="text-muted shrink-0 group-hover:text-default transition-colors"
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — limits, details, preferences */}
      <div className="xl:col-span-2 space-y-6">
        <div>
          <h4 className="text-sm font-semibold text-default mb-3">Plan limits</h4>
          <div className="space-y-1.5">
            <LimitItem label={`Up to ${org.planLimits.maxProjects} projects`} />
            <LimitItem label={`Up to ${org.planLimits.maxUsers} team members`} />
            <LimitItem label={`Up to ${org.planLimits.maxCases.toLocaleString()} AI-generated cases`} />
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="text-sm font-semibold text-default mb-3">Organization details</h4>
          <div className="space-y-0.5">
            <DetailRow label="Team" value={org.name}>
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted hover:text-default">Edit</Button>
            </DetailRow>
            <DetailRow
              label="Plan"
              value={<Badge className="capitalize">{org.plan}</Badge>}
            >
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-primary hover:text-primary-hover">
                Upgrade
              </Button>
            </DetailRow>
            <DetailRow label="Created" value="Jan 8, 2026">
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted hover:text-default">Edit</Button>
            </DetailRow>
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="text-sm font-semibold text-default mb-3">Preferences</h4>
          <div className="space-y-3">
            <PreferenceRow label="Default AI model" description="Used for AI case generation">
              <span className="text-sm text-default font-medium">Gemini 3.1 Flash Lite</span>
            </PreferenceRow>
            <PreferenceRow label="Default test framework" description="Applied when generating new test cases">
              <Select defaultValue="playwright">
                <SelectTrigger className="h-8 text-xs w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEST_FRAMEWORKS.map((f) => (
                    <SelectItem key={f} value={f.toLowerCase()}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PreferenceRow>
          </div>
        </div>
      </div>
    </div>
  )
}

function LimitItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <CheckCircle size={14} weight="fill" className="text-pass shrink-0" aria-hidden="true" />
      {label}
    </div>
  )
}

function DetailRow({
  label,
  value,
  children,
}: {
  label: string
  value: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 px-1 rounded-md hover:bg-canvas/60 transition-colors">
      <span className="text-xs text-muted w-20 shrink-0">{label}</span>
      <span className="text-sm text-default flex-1 min-w-0">{value}</span>
      {children}
    </div>
  )
}

function PreferenceRow({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-default">{label}</div>
        <div className="text-xs text-muted mt-0.5">{description}</div>
      </div>
      {children}
    </div>
  )
}
