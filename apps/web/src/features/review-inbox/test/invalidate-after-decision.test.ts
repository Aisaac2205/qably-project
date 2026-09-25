import { describe, it, expect, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import {
  invalidateReviewLists,
  invalidateSuiteAndProjectLists,
  invalidateAfterDecision,
} from '@/features/review-inbox/lib/invalidate-after-decision'
import { reviewKeys } from '@/features/review-inbox/lib/query-keys'
import { suiteKeys, projectKeys } from '@/features/projects/lib/query-keys'

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

describe('invalidateAfterDecision', () => {
  it('invalidates review, suite, and project caches, in that order', () => {
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')

    invalidateAfterDecision(client)

    expect(spy).toHaveBeenCalledTimes(3)
    expect(spy).toHaveBeenNthCalledWith(1, expect.objectContaining({ queryKey: reviewKeys.all }))
    expect(spy).toHaveBeenNthCalledWith(2, expect.objectContaining({ queryKey: suiteKeys.all }))
    expect(spy).toHaveBeenNthCalledWith(3, expect.objectContaining({ queryKey: projectKeys.all }))
  })
})
