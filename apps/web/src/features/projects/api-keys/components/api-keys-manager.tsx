'use client'

import { useState } from 'react'
import type { ApiKey, ApiKeyWithSecret } from '@qably/types'
import { useApiKeys } from '../hooks/use-api-keys'
import { useCreateApiKey, useRevokeApiKey } from '../hooks/use-api-key-mutations'
import { ApiKeyList } from './api-key-list'
import { CreateApiKeyDialog } from './create-api-key-dialog'
import { RevealTokenDialog } from './reveal-token-dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useTranslation } from '@/lib/i18n'

export function ApiKeysManager({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const { apiKeys, isLoading, isError } = useApiKeys(projectId)
  const createApiKeyMutation = useCreateApiKey(projectId)
  const revokeApiKeyMutation = useRevokeApiKey(projectId)

  const [createOpen, setCreateOpen] = useState(false)
  const [revealedKey, setRevealedKey] = useState<ApiKeyWithSecret | undefined>(undefined)
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | undefined>(undefined)

  function handleCreate(name: string) {
    createApiKeyMutation.mutate(
      { name },
      {
        onSuccess: (created) => {
          setCreateOpen(false)
          setRevealedKey(created)
        },
      },
    )
  }

  return (
    <>
      <ApiKeyList
        apiKeys={apiKeys}
        isLoading={isLoading}
        isError={isError}
        projectId={projectId}
        onCreateClick={() => setCreateOpen(true)}
        onRevoke={(key) => setRevokeTarget(key)}
      />

      <CreateApiKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        isSubmitting={createApiKeyMutation.isPending}
        error={createApiKeyMutation.isError ? t('apiKeys.createError') : undefined}
      />

      <RevealTokenDialog apiKey={revealedKey} onDismiss={() => setRevealedKey(undefined)} />

      <ConfirmDialog
        open={revokeTarget !== undefined}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(undefined)
        }}
        title={t('apiKeys.revokeTitle', { name: revokeTarget?.name ?? '' })}
        description={t('apiKeys.revokeDescription')}
        confirmLabel={t('apiKeys.revokeAction')}
        onConfirm={() => {
          if (revokeTarget) revokeApiKeyMutation.mutate(revokeTarget.id)
        }}
      />
    </>
  )
}
