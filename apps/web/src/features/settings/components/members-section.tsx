'use client'

import { useState } from 'react'
import { useMembers } from '@/lib/use-mock-store'
import { useInviteMember } from '../hooks/use-invite-member'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { User, Plus } from '@phosphor-icons/react'
import type { OrgMember } from '@qably/types'
import { useTranslation } from '@/lib/i18n'

const ROLE_VARIANT: Record<string, 'default' | 'warn' | 'skip'> = {
  owner: 'default',
  admin: 'warn',
  member: 'skip',
}

export function MembersSection() {
  const members = useMembers()
  const { invite, isLoading } = useInviteMember()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrgMember['role']>('member')

  const handleInvite = async () => {
    if (!email.trim()) return
    await invite({ email: email.trim(), role })
    setEmail('')
  }

  return (
    <div className="space-y-6">
      {/* Invite form */}
      <Card>
        <CardContent className="flex items-end gap-3 p-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium text-default" htmlFor="invite-email">
              {t('settings.members.email')}
            </label>
            <Input
              id="invite-email"
              type="email"
              placeholder={t('settings.members.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="w-28 space-y-1.5">
            <label className="text-sm font-medium text-default" htmlFor="invite-role">
              {t('settings.members.role')}
            </label>
            <Select value={role} onValueChange={(v) => setRole(v as OrgMember['role'])}>
              <SelectTrigger id="invite-role" className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">{t('settings.members.roleMember')}</SelectItem>
                <SelectItem value="admin">{t('settings.members.roleAdmin')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={handleInvite} disabled={isLoading || !email.trim()}>
            <Plus size={14} />
            {t('settings.members.invite')}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Members list */}
      <div>
        {members.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">{t('settings.members.noMembers')}</p>
        ) : (
          <>
            <div className="flex items-center gap-3 px-3 pb-2 border-b border-border">
              <div className="w-6 shrink-0" aria-hidden="true" />
              <span className="flex-1 text-xs font-semibold text-muted uppercase tracking-wide">{t('settings.members.name')}</span>
              <span className="text-xs font-semibold text-muted uppercase tracking-wide w-16 text-center shrink-0">{t('settings.members.role')}</span>
              <span className="text-xs font-semibold text-muted uppercase tracking-wide w-20 text-right shrink-0">{t('settings.members.joined')}</span>
            </div>
            <div className="space-y-0.5 mt-1">
              {members.map((member) => (
                <MemberRow key={member.id} member={member} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function MemberRow({ member }: { member: OrgMember }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-canvas/50 transition-colors">
      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
        <User size={12} weight="bold" className="text-primary" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-default truncate">{member.name}</div>
        <div className="text-xs text-muted truncate">{member.email}</div>
      </div>
      <Badge variant={ROLE_VARIANT[member.role] ?? 'skip'} className="capitalize">
        {member.role}
      </Badge>
      <span className="text-xs text-muted w-20 text-right shrink-0">
        {new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
      </span>
    </div>
  )
}
