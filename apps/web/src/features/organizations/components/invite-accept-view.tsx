'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import type { OrgInviteStatus } from '@qably/types'
import { Button, buttonVariants } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useInvitePreview } from '@/features/organizations/hooks/use-invite-preview'
import { useAcceptInvite } from '@/features/organizations/hooks/use-accept-invite'
import { useAuth } from '@/features/auth/hooks/use-auth'
import { useSession } from '@/lib/auth-client'
import { ApiError } from '@/lib/api-client'
import { applyOrganizationChange } from '@/lib/organization-context'
import { useTranslation } from '@/lib/i18n'

const ROLE_LABEL_KEYS: Record<string, string> = {
  owner: 'settings.members.roleOwner',
  admin: 'settings.members.roleAdmin',
  member: 'settings.members.roleMember',
}

const STATUS_COPY: Record<Exclude<OrgInviteStatus, 'pending'>, { titleKey: string; descriptionKey: string }> = {
  accepted: { titleKey: 'invite.usedTitle', descriptionKey: 'invite.usedDescription' },
  expired: { titleKey: 'invite.expiredTitle', descriptionKey: 'invite.expiredDescription' },
  revoked: { titleKey: 'invite.revokedTitle', descriptionKey: 'invite.revokedDescription' },
}

function classifyAcceptError(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'invite-invalid-or-used':
        return 'invite.notFoundTitle'
      case 'invite-expired':
        return 'invite.expiredTitle'
      case 'invite-email-mismatch':
        return 'invite.errorEmailMismatch'
      case 'seat-limit-reached':
        return 'invite.errorSeatLimitReached'
    }
  }
  return 'invite.errorGeneric'
}

function InviteStatusCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-lg font-semibold text-default">{title}</h1>
      <p className="text-sm text-muted">{description}</p>
    </div>
  )
}

export function InviteAcceptView({ token }: { token: string }) {
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session, isPending: isSessionPending } = useSession()
  const { logout } = useAuth()
  const { preview, isLoading, isError } = useInvitePreview(token)
  const acceptInvite = useAcceptInvite()
  const [acceptError, setAcceptError] = useState<string | null>(null)

  const nextParam = `?next=${encodeURIComponent(`/invite/${token}`)}`

  async function handleAccept() {
    setAcceptError(null)
    try {
      const result = await acceptInvite.mutateAsync(token)
      const userId = session?.user.id
      if (userId) {
        await applyOrganizationChange(queryClient, {
          organizationId: result.organizationId,
          userId,
        })
      }
      router.replace('/dashboard')
    } catch (error) {
      setAcceptError(t(classifyAcceptError(error)))
    }
  }

  if (isLoading || isSessionPending) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center bg-canvas text-muted"
        role="status"
        aria-live="polite"
      >
        <Spinner size="lg" />
        <span className="ml-2.5 text-sm">{t('common.loading')}</span>
      </div>
    )
  }

  if (isError || !preview) {
    return (
      <InviteStatusCard
        title={t('invite.notFoundTitle')}
        description={t('invite.notFoundDescription')}
      />
    )
  }

  if (preview.status !== 'pending') {
    const copy = STATUS_COPY[preview.status]
    return <InviteStatusCard title={t(copy.titleKey)} description={t(copy.descriptionKey)} />
  }

  const roleLabel = t(ROLE_LABEL_KEYS[preview.role] ?? preview.role)

  if (!session) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-lg font-semibold text-default">
          {t('invite.heading', { organizationName: preview.organizationName })}
        </h1>
        <p className="text-sm text-muted">
          {t('invite.description', { inviterName: preview.inviterName, role: roleLabel })}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href={`/login${nextParam}`} className={buttonVariants({ size: 'lg' })}>
            {t('invite.signInCta')}
          </Link>
          <Link
            href={`/register${nextParam}`}
            className={buttonVariants({ variant: 'outline', size: 'lg' })}
          >
            {t('invite.registerCta')}
          </Link>
        </div>
      </div>
    )
  }

  const emailMismatch = session.user.email.toLowerCase() !== preview.email.toLowerCase()

  if (emailMismatch) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-lg font-semibold text-default">{t('invite.mismatchTitle')}</h1>
        <p className="text-sm text-muted">
          {t('invite.mismatchDescription', { email: preview.email })}
        </p>
        <Button variant="outline" onClick={() => void logout()}>
          {t('invite.signOutCta')}
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-lg font-semibold text-default">
        {t('invite.heading', { organizationName: preview.organizationName })}
      </h1>
      <p className="text-sm text-muted">
        {t('invite.description', { inviterName: preview.inviterName, role: roleLabel })}
      </p>
      {acceptError && (
        <p role="alert" className="text-sm text-fail">
          {acceptError}
        </p>
      )}
      <Button size="lg" disabled={acceptInvite.isPending} onClick={() => void handleAccept()}>
        {acceptInvite.isPending ? t('invite.accepting') : t('invite.acceptCta')}
      </Button>
    </div>
  )
}
