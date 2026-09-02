import type { ApiKey, ApiKeyWithSecret } from '@qably/types'

export const apiKeyFixtures: ApiKey[] = [
  {
    id: 'key-1',
    projectId: 'proj-1',
    name: 'CI/CD Pipeline',
    prefix: 'qbly_a1b2c3',
    lastFour: '9f2a',
    createdAt: '2026-06-01T10:00:00Z',
    lastUsedAt: '2026-06-15T08:30:00Z',
  },
  {
    id: 'key-2',
    projectId: 'proj-1',
    name: 'Nightly regression',
    prefix: 'qbly_d4e5f6',
    lastFour: '7b3c',
    createdAt: '2026-05-10T09:00:00Z',
  },
  {
    id: 'key-3',
    projectId: 'proj-1',
    name: 'Old staging key',
    prefix: 'qbly_g7h8i9',
    lastFour: '1e5d',
    createdAt: '2026-01-01T00:00:00Z',
    lastUsedAt: '2026-02-01T00:00:00Z',
    revokedAt: '2026-03-01T00:00:00Z',
  },
  {
    id: 'key-4',
    projectId: 'proj-2',
    name: 'Other project key',
    prefix: 'qbly_j1k2l3',
    lastFour: '4m5n',
    createdAt: '2026-04-01T00:00:00Z',
  },
]

let apiKeys: ApiKey[] = structuredClone(apiKeyFixtures)

export function __resetApiKeysStub(): void {
  apiKeys = structuredClone(apiKeyFixtures)
}

export function listApiKeys(projectId: string): Promise<ApiKey[]> {
  return Promise.resolve(apiKeys.filter((key) => key.projectId === projectId))
}

export function createApiKey(
  projectId: string,
  payload: { name: string },
): Promise<ApiKeyWithSecret> {
  const created: ApiKeyWithSecret = {
    id: `key-${apiKeys.length + 1}`,
    projectId,
    name: payload.name,
    prefix: 'qbly_newkey',
    lastFour: 'zzzz',
    createdAt: '2026-06-17T00:00:00Z',
    token: 'qbly_newkey_supersecrettokenvalue',
  }
  apiKeys = [created, ...apiKeys]
  return Promise.resolve(created)
}

export function revokeApiKey(projectId: string, id: string): Promise<ApiKey> {
  const target = apiKeys.find((key) => key.id === id && key.projectId === projectId)
  if (target === undefined) {
    return Promise.reject(new Error(`api key ${id} not found`))
  }
  const revoked: ApiKey = { ...target, revokedAt: '2026-06-17T00:00:00Z' }
  apiKeys = apiKeys.map((key) => (key.id === id ? revoked : key))
  return Promise.resolve(revoked)
}
