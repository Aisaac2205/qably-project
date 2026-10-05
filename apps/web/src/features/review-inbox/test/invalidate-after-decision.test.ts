import { describe, it, expect, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  invalidateReviewLists,
  invalidateSuiteAndProjectLists,
  invalidateRunDetails,
  invalidateAfterDecision,
} from '@/features/review-inbox/lib/invalidate-after-decision'
import { reviewKeys } from '@/features/review-inbox/lib/query-keys'
import { suiteKeys, projectKeys } from '@/features/projects/lib/query-keys'
import { runKeys } from '@/features/runs/lib/query-keys'

describe('invalidateReviewLists', () => {
  it('invalidates only the review query key', () => {
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')

    invalidateReviewLists(client)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: reviewKeys.all }))
  })
})

describe('invalidateSuiteAndProjectLists', () => {
  it('invalidates suite and project caches, never the review list', () => {
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')

    invalidateSuiteAndProjectLists(client)

    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy).toHaveBeenNthCalledWith(1, expect.objectContaining({ queryKey: suiteKeys.all }))
    expect(spy).toHaveBeenNthCalledWith(2, expect.objectContaining({ queryKey: projectKeys.all }))
  })
})

describe('invalidateRunDetails', () => {
  it('marks run details stale without fetching them, and touches nothing else', () => {
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')

    invalidateRunDetails(client)

    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith({ queryKey: runKeys.details, refetchType: 'none' })
  })
})

describe('invalidateAfterDecision', () => {
  it('invalidates review, suite, project, and run detail caches, in that order', () => {
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')

    invalidateAfterDecision(client)

    expect(spy).toHaveBeenCalledTimes(4)
    expect(spy).toHaveBeenNthCalledWith(1, expect.objectContaining({ queryKey: reviewKeys.all }))
    expect(spy).toHaveBeenNthCalledWith(2, expect.objectContaining({ queryKey: suiteKeys.all }))
    expect(spy).toHaveBeenNthCalledWith(3, expect.objectContaining({ queryKey: projectKeys.all }))
    expect(spy).toHaveBeenNthCalledWith(4, expect.objectContaining({ queryKey: runKeys.details }))
  })
})
