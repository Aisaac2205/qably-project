import type { QueryClient } from '@tanstack/react-query'

let registeredQueryClient: QueryClient | null = null

export function registerQueryClient(client: QueryClient): void {
  registeredQueryClient = client
}

export function getRegisteredQueryClient(): QueryClient | null {
  return registeredQueryClient
}

export function resetQueryClientRegistry(): void {
  registeredQueryClient = null
}
