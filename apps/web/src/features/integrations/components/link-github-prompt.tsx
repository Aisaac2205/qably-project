'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'
import { authClient } from '@/lib/auth-client'
import { useHasLinkedGithub } from '../hooks/use-has-linked-github'

export function LinkGithubPrompt() {
  const { t } = useTranslation()
  const { hasLinkedGithub, isLoading } = useHasLinkedGithub()
  const [isLinking, setIsLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLink() {
    setError(null)
    setIsLinking(true)

    const { error: linkError } = await authClient.linkSocial({
      provider: 'github',
      callbackURL: `${window.location.origin}${window.location.pathname}${window.location.search}`,
    })

    if (linkError) {
      setError(t('projects.linkGithubFailed'))
      setIsLinking(false)
    }
  }

  if (isLoading || hasLinkedGithub !== false) return null

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
      <Image
        src="/logos/github.svg"
        alt=""
        width={20}
        height={20}
        aria-hidden="true"
        className="shrink-0"
      />
      <div className="flex-1 space-y-0.5">
        <p className="text-sm font-semibold text-default">
          {t('projects.linkGithubTitle')}
        </p>
        <p className="text-xs text-muted">{t('projects.linkGithubDescription')}</p>
        {error && (
          <p role="alert" className="text-xs text-fail">
            {error}
          </p>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        onClick={() => void handleLink()}
        disabled={isLinking}
      >
        {isLinking ? t('projects.linkGithubLinking') : t('projects.linkGithubCta')}
      </Button>
    </div>
  )
}
