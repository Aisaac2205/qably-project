import { vi } from 'vitest'
import type { ReviewApprovalConflictCode, ReviewConflictingCase } from '@qably/types'
import { ApiError, apiRequest } from '@/lib/api-client'

const CONFLICT_MESSAGES: Record<ReviewApprovalConflictCode, string> = {
  'name-taken': 'Another official case in this suite already uses that title',
  'automation-key-taken':
    'Another official case in this suite already runs as that automated test',
  'publish-conflict': 'Publishing collided with another change to the official cases. Try again',
}

export const conflictingCaseFixture: ReviewConflictingCase = {
  id: 'cmum0000000000000000000000',
  name: 'Empties the cart',
  suiteId: 'cmum1111111111111111111111',
}

export function approvalConflictBody(
  code: ReviewApprovalConflictCode,
  conflictingCase: ReviewConflictingCase | null,
) {
  return {
    statusCode: 409,
    code,
    message: CONFLICT_MESSAGES[code],
    conflictingCase,
    path: '/review/proposals/cmum2222222222222222222222/approve',
    timestamp: '2026-09-28T22:19:01.000Z',
  }
}

export async function approvalConflictError(
  code: ReviewApprovalConflictCode,
  conflictingCase: ReviewConflictingCase | null,
): Promise<ApiError> {
  const body = approvalConflictBody(code, conflictingCase)
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () => Promise.resolve(body),
    }),
  )

  try {
    await apiRequest('/review/proposals/cmum2222222222222222222222/approve', {
      method: 'POST',
      body: {},
    })
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  } finally {
    vi.unstubAllGlobals()
  }

  throw new Error('The stubbed approval request was expected to fail')
}
