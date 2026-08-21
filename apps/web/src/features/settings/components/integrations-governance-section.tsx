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
      type: 'discord',
      name: t('modules.integrations.newName'),
      config: { descriptionKey: 'modules.integrations.newDescription' },
    })
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-2xs" aria-labelledby="integrations-governance-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-0.5">
          <h2 id="integrations-governance-heading" className="text-sm font-semibold text-default">
            {t('settings.integrationsGovernance.title')}
          </h2>
          <p className="text-xs text-muted-foreground">{t('settings.integrationsGovernance.description')}</p>
        </div>
        <Button size="sm" onClick={addIntegration} className="gap-1.5 active:scale-[0.98] transition-transform">
          <Plus size={14} weight="bold" aria-hidden="true" />
          <span>{t('settings.integrationsGovernance.add')}</span>
        </Button>
      </div>

      <ul aria-label={t('settings.integrationsGovernance.title')} className="mt-4 divide-y divide-border/70">
        {governedConnections.map((connection) => (
          <li
            key={connection.id}
            className="group flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-1 last:pb-0 transition-colors rounded-lg hover:bg-canvas/30 px-2 -mx-2"
          >
            <div className="flex min-w-0 items-center gap-3">
              <ConnectionLogo name={connection.name} type={connection.type} />
              <div className="min-w-0 space-y-0.5">
                <p className="truncate text-sm font-semibold text-default">{connection.name}</p>
                <p className="truncate text-xs text-muted">{connectionResource(connection, notConnected, t)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <ConnectionStatus status={connection.status} />
              <ConnectionActions connection={connection} onTransition={transition} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
