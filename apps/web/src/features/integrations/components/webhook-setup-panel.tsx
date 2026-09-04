'use client'

import { useState } from 'react'
import { Check, Copy } from '@phosphor-icons/react'
import type { RepoConnectionProvider } from '@qably/types'
import { resolveApiBaseUrl } from '@/lib/api-base-url'
import { useTranslation } from '@/lib/i18n'

interface WebhookSetupPanelProps {
  provider: RepoConnectionProvider
  secret?: string
}

interface CopyRowProps {
  label: string
  value: string
  copyLabel: string
  copiedLabel: string
  mono?: boolean
}

function CopyRow({ label, value, copyLabel, copiedLabel, mono = false }: CopyRowProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-default">{label}</span>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2">
        <span
          className={`min-w-0 flex-1 break-all text-xs text-default ${mono ? 'font-mono' : ''}`}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copyLabel}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border text-muted transition-colors hover:bg-surface-hover hover:text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97]"
        >
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        </button>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? copiedLabel : ''}
      </span>
    </div>
  )
}

export function WebhookSetupPanel({ provider, secret }: WebhookSetupPanelProps) {
  const { t } = useTranslation()
  const payloadUrl = `${resolveApiBaseUrl()}/webhooks/scm/${provider.toLowerCase()}`
  const isGithub = provider === 'GITHUB'
  const stepsHeading = isGithub
    ? t('webhookSetup.stepsHeadingGithub')
    : t('webhookSetup.stepsHeadingBitbucket')
  const steps = isGithub
    ? [
        t('webhookSetup.githubStep1'),
        t('webhookSetup.githubStep2'),
        t('webhookSetup.githubStep3'),
        t('webhookSetup.githubStep4'),
        t('webhookSetup.githubStep5'),
      ]
    : [
        t('webhookSetup.bitbucketStep1'),
        t('webhookSetup.bitbucketStep2'),
        t('webhookSetup.bitbucketStep3'),
        t('webhookSetup.bitbucketStep4'),
        t('webhookSetup.bitbucketStep5'),
      ]

  return (
    <div className="space-y-4">
      {secret !== undefined ? (
        <p className="rounded-lg border border-warn/30 bg-warn-bg px-3 py-2.5 text-xs font-medium text-warn">
          {t('webhookSetup.secretOnceWarning')}
        </p>
      ) : null}

      <CopyRow
        label={t('webhookSetup.payloadUrlLabel')}
        value={payloadUrl}
        copyLabel={t('webhookSetup.copyPayloadUrl')}
        copiedLabel={t('webhookSetup.payloadUrlCopied')}
        mono
      />

      {secret !== undefined ? (
        <CopyRow
          label={t('webhookSetup.secretLabel')}
          value={secret}
          copyLabel={t('webhookSetup.copySecret')}
          copiedLabel={t('webhookSetup.secretCopied')}
          mono
        />
      ) : (
        <p className="text-xs text-muted">{t('webhookSetup.secretUnavailable')}</p>
      )}

      <CopyRow
        label={t('webhookSetup.contentTypeLabel')}
        value="application/json"
        copyLabel={t('webhookSetup.copyContentType')}
        copiedLabel={t('webhookSetup.contentTypeCopied')}
        mono
      />

      <CopyRow
        label={t('webhookSetup.eventsLabel')}
        value={t('webhookSetup.eventsValue')}
        copyLabel={t('webhookSetup.copyEvents')}
        copiedLabel={t('webhookSetup.eventsCopied')}
      />

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
          {stepsHeading}
        </h3>
        <ol className="list-decimal space-y-1.5 pl-4 text-xs text-default marker:text-muted">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    </div>
  )
}
