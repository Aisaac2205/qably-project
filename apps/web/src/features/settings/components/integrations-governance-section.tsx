'use client'

import { Plus } from '@phosphor-icons/react'
import {
  ConnectionActions,
  ConnectionLogo,
  ConnectionStatus,
  connectionResource,
  useConnections,
} from '@/features/integrations'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/i18n'

/**
 * Global governance surface for connection credentials (Phase 2 split of
 * the CI/SCM-free remainder of the monolithic /integrations page). CI
 * adapters live in Project Runs; SCM sources live in Project Repository.
 */
export function IntegrationsGovernanceSection() {
  const { connections, create, transition } = useConnections()
  const { t } = useTranslation()
  const notConnected = t('modules.integrations.notConnected')

  const governedConnections = connections.filter(
    (connection) => connection.config?.category !== 'scm' && connection.config?.category !== 'ci',
  )

  const addIntegration = () => {
    create({
      type: 'email',
      name: t('modules.integrations.newName'),
      config: { description: t('modules.integrations.newDescription') },
    })
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby="integrations-governance-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="integrations-governance-heading" className="text-sm font-semibold text-default">
            {t('settings.integrationsGovernance.title')}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('settings.integrationsGovernance.description')}</p>
        </div>
        <Button size="sm" onClick={addIntegration}>
          <Plus size={14} weight="bold" aria-hidden="true" />
          {t('modules.integrations.add')}
        </Button>
      </div>

      <ul aria-label={t('settings.integrationsGovernance.title')} className="mt-4 divide-y divide-border">
        {governedConnections.map((connection) => (
          <li key={connection.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex min-w-0 items-center gap-3">
              <ConnectionLogo name={connection.name} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-default">{connection.name}</p>
                <p className="truncate text-xs text-muted">{connectionResource(connection, notConnected)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ConnectionStatus status={connection.status} />
              <ConnectionActions connection={connection} onTransition={transition} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
