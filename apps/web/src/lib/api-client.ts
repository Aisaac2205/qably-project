import { resolveApiBaseUrl } from '@/lib/api-base-url'
import { useI18nStore } from '@/lib/i18n/store'
import { useActiveOrganizationStore } from '@/stores/active-organization.store'

const ORGANIZATION_HEADER = 'x-organization-id'
const NOT_A_MEMBER_ERROR_CODE = 'not-a-member'

export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: object
  organizationId?: string
  signal?: AbortSignal
}

function resolveOrganizationId(options: ApiRequestOptions): string | undefined {
  if (options.organizationId !== undefined) return options.organizationId
  return useActiveOrganizationStore.getState().organizationId ?? undefined
}

function buildHeaders(options: ApiRequestOptions, organizationId: string | undefined): Headers {
  const headers = new Headers()

  headers.set('accept-language', useI18nStore.getState().locale)

  if (options.body !== undefined) {
    headers.set('content-type', 'application/json')
  }
  if (organizationId !== undefined) {
    headers.set(ORGANIZATION_HEADER, organizationId)
  }

  return headers
}

async function readErrorBody(
  response: Response,
  fallback: string,
): Promise<{ message: string; code?: string }> {
  try {
    const payload = (await response.json()) as { message?: unknown; code?: unknown }
    const message = typeof payload.message === 'string' ? payload.message : fallback
    return typeof payload.code === 'string'
      ? { message, code: payload.code }
      : { message }
  } catch {
    return { message: fallback }
  }
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  return performRequest<T>(path, options, false)
}

async function performRequest<T>(
  path: string,
  options: ApiRequestOptions,
  isRetry: boolean,
): Promise<T> {
  const organizationId = resolveOrganizationId(options)
  const organizationIdWasInjected = options.organizationId === undefined && organizationId !== undefined

  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: buildHeaders(options, organizationId),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  })

  if (!response.ok) {
    const { message, code } = await readErrorBody(response, `Request to ${path} failed`)

    if (
      !isRetry &&
      organizationIdWasInjected &&
      response.status === 403 &&
      code === NOT_A_MEMBER_ERROR_CODE
    ) {
      useActiveOrganizationStore.getState().clearActiveOrganization()
      return performRequest<T>(path, options, true)
    }

    throw new ApiError(response.status, message, code)
  }

  if (response.status === 204) return undefined as T

  return (await response.json()) as T
}
