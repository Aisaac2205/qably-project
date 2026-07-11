'use client'

import { useState } from 'react'
import { useAiProviders } from '@/lib/use-mock-store'
import { useConnectAiProvider } from '../hooks/use-connect-ai-provider'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Robot } from '@phosphor-icons/react'

export function AiProvidersSection() {
  const providers = useAiProviders()
  const { connect, disconnect, isLoading } = useConnectAiProvider()
  const [keyDrafts, setKeyDrafts] = useState<Record<string, string>>({})

  return (
    <Card>
      <CardContent className="space-y-6 pt-4">
        {providers.map((provider, i) => (
          <div key={provider.provider}>
            {i > 0 && <Separator className="mb-6" />}
            <div className="flex items-center gap-3">
              <Robot
                size={20}
                weight="duotone"
                className={provider.connected ? 'text-pass' : 'text-muted'}
                aria-hidden="true"
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-default flex items-center gap-2">
                  {provider.label}
                  <Badge variant={provider.connected ? 'pass' : 'skip'}>
                    {provider.connected ? 'Connected' : 'Not connected'}
                  </Badge>
                </div>
                {provider.connected ? (
                  <p className="text-xs text-muted mt-0.5 font-mono">{provider.maskedKey}</p>
                ) : (
                  <p className="text-xs text-muted mt-0.5">Model: {provider.model}</p>
                )}
              </div>
              {provider.connected ? (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isLoading}
                  onClick={() => disconnect(provider.provider)}
                >
                  Disconnect {provider.label}
                </Button>
              ) : null}
            </div>

            {!provider.connected && (
              <div className="mt-3 flex items-center gap-2">
                <Input
                  type="password"
                  aria-label={`${provider.label} API key`}
                  placeholder="Paste API key"
                  value={keyDrafts[provider.provider] ?? ''}
                  onChange={(e) =>
                    setKeyDrafts((prev) => ({ ...prev, [provider.provider]: e.target.value }))
                  }
                  className="max-w-xs"
                />
                <Button
                  size="sm"
                  disabled={isLoading || !(keyDrafts[provider.provider] ?? '').trim()}
                  onClick={() => connect(provider.provider, keyDrafts[provider.provider] ?? '')}
                >
                  Connect {provider.label}
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
