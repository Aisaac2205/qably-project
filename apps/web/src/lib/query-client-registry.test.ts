import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'
import {
  getRegisteredQueryClient,
  registerQueryClient,
  resetQueryClientRegistry,
} from './query-client-registry'

afterEach(() => {
  resetQueryClientRegistry()
})

describe('query client registry', () => {
  it('has no registered client until one is registered', () => {
    expect(getRegisteredQueryClient()).toBeNull()
  })

  it('returns the client that was registered', () => {
    const client = new QueryClient()

    registerQueryClient(client)

    expect(getRegisteredQueryClient()).toBe(client)
  })

  it('returns the latest registration when registered more than once', () => {
    const first = new QueryClient()
    const second = new QueryClient()

    registerQueryClient(first)
    registerQueryClient(second)

    expect(getRegisteredQueryClient()).toBe(second)
  })
})
