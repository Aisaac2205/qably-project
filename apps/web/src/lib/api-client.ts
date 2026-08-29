import { resolveApiBaseUrl } from '@/lib/api-base-url'

const ORGANIZATION_HEADER = 'x-organization-id'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  organizationId?: string
  signal?: AbortSignal
}

function buildHeaders(options: ApiRequestOptions): Headers {
  const headers = new Headers()

  if (options.body !== undefined) {
    headers.set('content-type', 'application/json')
  }
  if (options.organizationId !== undefined) {
    headers.set(ORGANIZATION_HEADER, options.organizationId)
  }

  return headers
}

async function readMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: unknown }
    return typeof payload.message === 'string' ? payload.message : fallback
  } catch {
    return fallback
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: buildHeaders(options),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  })

  if (!response.ok) {
    throw new ApiError(
      response.status,
      await readMessage(response, `Request to ${path} failed`),
    )
  }

  if (response.status === 204) return undefined as T

  return (await response.json()) as T
}
