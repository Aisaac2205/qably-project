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

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-primary text-primary-fg',
  admin: 'bg-warn-bg text-warn',
  member: 'bg-skip-bg text-skip',
}

export function MembersSection() {
  const members = useMembers()
  const { invite, isLoading } = useInviteMember()
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
            <label className="text-xs font-medium text-default" htmlFor="invite-email">
              Email
            </label>
            <Input
              id="invite-email"
              type="email"
              placeholder="email@acme.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <div className="w-28 space-y-1.5">
            <label className="text-xs font-medium text-default" htmlFor="invite-role">
              Role
            </label>
            <Select value={role} onValueChange={(v) => setRole(v as OrgMember['role'])}>
              <SelectTrigger id="invite-role" className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={handleInvite} disabled={isLoading || !email.trim()}>
            <Plus size={14} />
            Invite
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Members list */}
      <div className="space-y-1">
        {members.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">No members yet</p>
        ) : (
          members.map((member) => (
            <MemberRow key={member.id} member={member} />
          ))
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
        <div className="text-xs font-medium text-default truncate">{member.name}</div>
        <div className="text-[10px] text-muted truncate">{member.email}</div>
      </div>
      <Badge className={`text-[10px] capitalize ${ROLE_COLORS[member.role] ?? 'bg-skip-bg text-skip'}`}>
        {member.role}
      </Badge>
      <span className="text-[10px] text-muted w-20 text-right shrink-0">
        {new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
      </span>
    </div>
  )
}
