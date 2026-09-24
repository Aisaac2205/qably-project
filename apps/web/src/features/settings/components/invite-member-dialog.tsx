'use client'

import { useState, type FormEvent } from 'react'
import type { OrgRole } from '@qably/types'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslation } from '@/lib/i18n'

type InvitableRole = Extract<OrgRole, 'admin' | 'member'>

interface InviteMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: { email: string; role: InvitableRole }) => void
  isSubmitting: boolean
  error?: string
}

export function InviteMemberDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  error,
}: InviteMemberDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <InviteMemberDialogContent
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          error={error}
        />
      )}
    </Dialog>
  )
}

function InviteMemberDialogContent({
  onOpenChange,
  onSubmit,
  isSubmitting,
  error,
}: Omit<InviteMemberDialogProps, 'open'>) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InvitableRole>('member')
  const [validationError, setValidationError] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setValidationError(t('settings.members.emailPlaceholder'))
      return
    }

    setValidationError('')
    onSubmit({ email: trimmedEmail, role })
  }

  const displayedError = validationError || error

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>{t('settings.members.inviteDialogTitle')}</DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
        <div className="grid gap-2">
          <Label htmlFor="invite-email">{t('settings.members.email')}</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              if (validationError) setValidationError('')
            }}
            placeholder={t('settings.members.emailPlaceholder')}
            aria-invalid={Boolean(displayedError)}
            autoFocus
            disabled={isSubmitting}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="invite-role">{t('settings.members.inviteRoleLabel')}</Label>
          <Select value={role} onValueChange={(value) => setRole(value as InvitableRole)}>
            <SelectTrigger id="invite-role" disabled={isSubmitting}>
              <SelectValue>{t(`settings.members.role${role === 'admin' ? 'Admin' : 'Member'}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">{t('settings.members.roleMember')}</SelectItem>
              <SelectItem value="admin">{t('settings.members.roleAdmin')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {displayedError && (
          <p role="alert" className="text-xs text-fail">
            {displayedError}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('settings.members.inviting') : t('settings.members.invite')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
