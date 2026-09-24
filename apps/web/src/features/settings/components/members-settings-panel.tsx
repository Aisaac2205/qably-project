'use client'

import { useState } from 'react'
import { Plus } from '@phosphor-icons/react'
import type { OrgMember, OrgRole } from '@qably/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EntityList } from '@/components/ui/entity-list'
import { StateView } from '@/components/ui/state-view'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserAvatar } from '@/components/shell/user-avatar'
import { useTranslation } from '@/lib/i18n'
import { useCurrentOrganization } from '@/features/organizations/hooks/use-current-organization'
import { useMembers } from '@/features/organizations/hooks/use-members'
import { useInvites } from '@/features/organizations/hooks/use-invites'
import {
  classifyMemberError,
  useChangeMemberRole,
  useRemoveMember,
} from '@/features/organizations/hooks/use-member-mutations'
import {
  classifyInviteError,
  useCreateInvite,
  useResendInvite,
  useRevokeInvite,
} from '@/features/organizations/hooks/use-invite-mutations'
import type { OrgInviteSummary } from '@/features/organizations/api/invites.api'
import { InviteMemberDialog } from './invite-member-dialog'

const ROLE_LABEL_KEYS: Record<OrgRole, string> = {
  owner: 'settings.members.roleOwner',
  admin: 'settings.members.roleAdmin',
  member: 'settings.members.roleMember',
}

const MEMBER_ERROR_KEYS: Record<ReturnType<typeof classifyMemberError>, string> = {
  forbidden: 'settings.members.errorForbidden',
  'not-found': 'settings.members.errorNotFound',
  'last-owner-required': 'settings.members.errorLastOwnerRequired',
  error: 'settings.members.errorGeneric',
}

const INVITE_ERROR_KEYS: Record<ReturnType<typeof classifyInviteError>, string> = {
  forbidden: 'settings.members.errorForbidden',
  'not-found': 'settings.members.errorNotFound',
  'seat-limit-reached': 'settings.members.errorSeatLimitReached',
  'already-member': 'settings.members.errorAlreadyMember',
  error: 'settings.members.errorGeneric',
}

export function MembersSettingsPanel() {
  const { t } = useTranslation()
  const { organization } = useCurrentOrganization()
  const actorRole = organization?.role
  const canManage = actorRole === 'owner' || actorRole === 'admin'
  const isOwner = actorRole === 'owner'

  const { members, isLoading: membersLoading, isError: membersError } = useMembers(canManage)
  const { invites, isLoading: invitesLoading } = useInvites(canManage)

  const changeRole = useChangeMemberRole()
  const removeMember = useRemoveMember()
  const createInvite = useCreateInvite()
  const revokeInvite = useRevokeInvite()
  const resendInvite = useResendInvite()

  const [memberError, setMemberError] = useState<string | null>(null)
  const [pendingInviteError, setPendingInviteError] = useState<string | null>(null)
  const [createInviteError, setCreateInviteError] = useState<string | null>(null)
  const [removeTarget, setRemoveTarget] = useState<OrgMember | undefined>(undefined)
  const [revokeTarget, setRevokeTarget] = useState<OrgInviteSummary | undefined>(undefined)
  const [inviteOpen, setInviteOpen] = useState(false)

  if (!canManage) {
    return (
      <section aria-labelledby="members-heading" className="space-y-5">
        <h2 id="members-heading" className="text-sm font-semibold text-default">
          {t('settings.members.title')}
        </h2>
        <StateView kind="no-permission" title={t('settings.members.noPermission')} />
      </section>
    )
  }

  function canTouchOwnership(member: OrgMember): boolean {
    return isOwner || member.role !== 'owner'
  }

  function handleRoleChange(member: OrgMember, role: OrgRole) {
    setMemberError(null)
    changeRole.mutate(
      { memberId: member.id, role },
      { onError: (error: unknown) => setMemberError(t(MEMBER_ERROR_KEYS[classifyMemberError(error)])) },
    )
  }

  function handleConfirmRemove() {
    if (!removeTarget) return
    setMemberError(null)
    removeMember.mutate(removeTarget.id, {
      onError: (error: unknown) => setMemberError(t(MEMBER_ERROR_KEYS[classifyMemberError(error)])),
    })
  }

  function handleConfirmRevoke() {
    if (!revokeTarget) return
    setPendingInviteError(null)
    revokeInvite.mutate(revokeTarget.id)
  }

  async function handleResend(invite: OrgInviteSummary) {
    setPendingInviteError(null)
    try {
      await resendInvite.mutateAsync(invite.id)
    } catch {
      setPendingInviteError(t('settings.members.resendError'))
    }
  }

  function handleInvite(input: { email: string; role: 'admin' | 'member' }) {
    setCreateInviteError(null)
    createInvite.mutate(input, {
      onSuccess: () => setInviteOpen(false),
      onError: (error: unknown) => setCreateInviteError(t(INVITE_ERROR_KEYS[classifyInviteError(error)])),
    })
  }

  function handleInviteOpenChange(open: boolean) {
    setInviteOpen(open)
    if (!open) setCreateInviteError(null)
  }

  return (
    <section className="space-y-6" aria-labelledby="members-heading">
      <header className="flex flex-wrap items-start justify-between gap-4 pb-1">
        <div className="space-y-0.5">
          <h2 id="members-heading" className="text-sm font-semibold text-default">
            {t('settings.members.title')}
          </h2>
          <p className="text-xs text-muted-foreground max-w-xl">
            {t('settings.members.description')}
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setInviteOpen(true)}>
          <Plus size={14} weight="bold" aria-hidden="true" />
          {t('settings.members.invite')}
        </Button>
      </header>

      {memberError && (
        <p role="alert" className="text-xs text-fail">
          {memberError}
        </p>
      )}

      {membersLoading ? (
        <StateView kind="loading" title={t('common.loading')} />
      ) : membersError ? (
        <StateView kind="error" title={t('settings.members.loadError')} />
      ) : members.length === 0 ? (
        <StateView kind="empty" title={t('settings.members.noMembers')} />
      ) : (
        <Card className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
          <CardContent className="p-0">
            <EntityList aria-label={t('settings.members.title')}>
              {members.map((member) => {
                const editable = canTouchOwnership(member)
                return (
                  <li key={member.id} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5 sm:py-3.5">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <UserAvatar name={member.name} image={member.avatarUrl ?? null} size={32} />
                      <div className="min-w-0 space-y-0.5">
                        <span className="block text-sm font-semibold text-default truncate">
                          {member.name}
                        </span>
                        <span className="block text-xs text-muted truncate">{member.email}</span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Select
                        value={member.role}
                        onValueChange={(value) => handleRoleChange(member, value as OrgRole)}
                        disabled={!editable || changeRole.isPending}
                      >
                        <SelectTrigger aria-label={t('settings.members.role')} className="w-32">
                          <SelectValue>{t(ROLE_LABEL_KEYS[member.role])}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">{t('settings.members.roleMember')}</SelectItem>
                          <SelectItem value="admin">{t('settings.members.roleAdmin')}</SelectItem>
                          {isOwner && (
                            <SelectItem value="owner">{t('settings.members.roleOwner')}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>

                      {editable && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => setRemoveTarget(member)}
                        >
                          {t('settings.members.remove')}
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </EntityList>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          {t('settings.members.pendingInvitesTitle')}
        </h3>

        {pendingInviteError && (
          <p role="alert" className="text-xs text-fail">
            {pendingInviteError}
          </p>
        )}

        {!invitesLoading && invites.length === 0 ? (
          <p className="text-xs text-muted">{t('settings.members.pendingInvitesEmpty')}</p>
        ) : (
          <Card className="rounded-xl border border-border bg-surface shadow-card overflow-hidden">
            <CardContent className="p-0">
              <EntityList aria-label={t('settings.members.pendingInvitesTitle')}>
                {invites.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5 sm:py-3.5">
                    <div className="min-w-0 space-y-0.5">
                      <span className="block text-sm font-semibold text-default truncate">
                        {invite.email}
                      </span>
                      <span className="block text-xs text-muted truncate">
                        {t(ROLE_LABEL_KEYS[invite.role])}
                        {invite.invitedByName
                          ? ` · ${t('settings.members.invitedBy', { name: invite.invitedByName })}`
                          : ''}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={resendInvite.isPending}
                        onClick={() => void handleResend(invite)}
                      >
                        {t('settings.members.resend')}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setRevokeTarget(invite)}
                      >
                        {t('settings.members.revoke')}
                      </Button>
                    </div>
                  </li>
                ))}
              </EntityList>
            </CardContent>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={removeTarget !== undefined}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(undefined)
        }}
        title={t('settings.members.removeTitle', { name: removeTarget?.name ?? '' })}
        description={t('settings.members.removeDescription')}
        confirmLabel={t('settings.members.remove')}
        onConfirm={handleConfirmRemove}
      />

      <ConfirmDialog
        open={revokeTarget !== undefined}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(undefined)
        }}
        title={t('settings.members.revokeTitle', { email: revokeTarget?.email ?? '' })}
        description={t('settings.members.revokeDescription')}
        confirmLabel={t('settings.members.revoke')}
        onConfirm={handleConfirmRevoke}
      />

      <InviteMemberDialog
        open={inviteOpen}
        onOpenChange={handleInviteOpenChange}
        onSubmit={handleInvite}
        isSubmitting={createInvite.isPending}
        error={createInviteError ?? undefined}
      />
    </section>
  )
}
