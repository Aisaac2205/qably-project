'use client'

import { useIntegration } from '@/lib/use-mock-store'
import { useUpdateGithubIntegration } from '../hooks/use-update-github-integration'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { GitFork, Link, Plug, Plugs } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export function IntegrationsSection() {
  const integration = useIntegration()
  const { update, isLoading } = useUpdateGithubIntegration()
  const { t } = useTranslation()

  const handleToggle = () => {
    update({ connected: !integration.connected })
  }

  return (
    <Card>
      <CardContent className="space-y-6 pt-4">
        {/* Status */}
        <div className="flex items-center gap-3">
          {integration.connected ? (
            <Plug size={20} weight="duotone" className="text-pass" aria-hidden="true" />
          ) : (
            <Plugs size={20} weight="duotone" className="text-muted" aria-hidden="true" />
          )}
          <div className="flex-1">
            <div className="text-sm font-medium text-default flex items-center gap-2">
              {t('settings.integrations.githubTitle')}
              <Badge variant={integration.connected ? 'pass' : 'skip'}>
                {integration.connected ? t('settings.integrations.connected') : t('settings.integrations.notConnected')}
              </Badge>
            </div>
            <p className="text-xs text-muted mt-0.5">
              {t('settings.integrations.webhookDesc')}
            </p>
          </div>
          <Button
            size="sm"
            variant={integration.connected ? 'destructive' : 'default'}
            onClick={handleToggle}
            disabled={isLoading}
          >
            {integration.connected ? t('settings.integrations.disconnect') : t('settings.integrations.connect')}
          </Button>
        </div>

        <Separator />

        {/* Webhook URL */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-default">{t('settings.integrations.webhookUrl')}</label>
          <div className="flex items-center gap-2 p-2 rounded-md bg-canvas border border-border">
            <Link size={14} className="text-muted shrink-0" aria-hidden="true" />
            <code className="text-xs font-mono text-default truncate flex-1">
              {integration.webhookUrl || 'https://api.qably.io/webhooks/github/org-1'}
            </code>
          </div>
        </div>

        {/* Repo URL */}
        {integration.connected && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-default flex items-center gap-1.5">
              <GitFork size={14} className="text-muted" aria-hidden="true" />
              {t('settings.integrations.repositoryUrl')}
            </label>
            <div className="flex items-center gap-2 p-2 rounded-md bg-canvas border border-border">
              <code className="text-xs font-mono text-default truncate flex-1">
                {integration.repoUrl || 'https://github.com/acme/ecommerce-app'}
              </code>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
