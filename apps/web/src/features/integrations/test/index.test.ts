import { describe, expect, it } from 'vitest'
import { useConnections } from '@/features/integrations'
import { useConnections as useRealConnections } from '@/features/integrations/hooks/use-connections'

describe('integrations barrel', () => {
  it('re-exports the real API-backed useConnections, not the mock aggregate', () => {
    expect(useConnections).toBe(useRealConnections)
  })
})
