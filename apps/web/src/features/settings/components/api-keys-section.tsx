'use client'

import { useState } from 'react'
import { useApiKeys } from '@/lib/use-mock-store'
import { useCreateApiKey } from '../hooks/use-create-api-key'
import { useRevokeApiKey } from '../hooks/use-revoke-api-key'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Key, Plus, Trash } from '@phosphor-icons/react'

export function ApiKeysSection() {
  const keys = useApiKeys()
  const { create, isLoading: creating } = useCreateApiKey()
  const { confirmingId, requestRevoke, cancelRevoke, confirmRevoke, isLoading: revoking } = useRevokeApiKey()
  const [name, setName] = useState('')

  const handleCreate = async () => {
    if (!name.trim()) return
    await create(name.trim())
    setName('')
  }

  const keyToRevoke = keys.find((k) => k.id === confirmingId)

  return (
    <div className="space-y-6">
      {/* Create form */}
      <Card>
        <CardContent className="flex items-end gap-3 p-3">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-default" htmlFor="key-name">
              Key Name
            </label>
            <Input
              id="key-name"
              type="text"
              placeholder="Key name e.g. CI/CD"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
          <Button size="sm" onClick={handleCreate} disabled={creating || !name.trim()}>
            <Plus size={14} />
            Create
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Keys list */}
      <div className="space-y-1">
        {keys.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">No API keys yet</p>
        ) : (
          keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-canvas/50 transition-colors"
            >
              <div className="w-6 h-6 rounded bg-ai-bg flex items-center justify-center shrink-0">
                <Key size={12} weight="bold" className="text-ai" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-default truncate">{key.name}</div>
                <div className="text-[10px] text-muted font-mono">
                  {key.prefix}••••{key.lastFour}
                </div>
              </div>
              <span className="text-[10px] text-muted w-20 text-right shrink-0">
                {new Date(key.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </span>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => requestRevoke(key.id)}
                aria-label={`Revoke ${key.name}`}
                disabled={revoking}
              >
                <Trash size={12} />
                Revoke
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Revoke confirmation dialog */}
      <Dialog open={confirmingId !== null} onOpenChange={() => cancelRevoke()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke "{keyToRevoke?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelRevoke}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmingId && confirmRevoke(confirmingId)}
              disabled={revoking}
            >
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
