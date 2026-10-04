import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CiRunSummaryRecord } from '@qably/types'
import { useCiRunLabel } from '@/features/runs/hooks/use-ci-run-label'
import { ciRunSummary } from './ci-run-fixtures'

function labelOf(ciRun: Partial<CiRunSummaryRecord> | undefined) {
  return renderHook(({ source }) => useCiRunLabel(source), {
    initialProps: { source: ciRun === undefined ? undefined : ciRunSummary('c1', ciRun) },
  })
}

describe('useCiRunLabel', () => {
  it('reads CI #N from the run number', () => {
    const { result } = labelOf({ runNumber: 42, commitSha: 'a1b2c3d4e5f60718' })

    expect(result.current).toBe('CI #42')
  })

  it('shows the short SHA when the run number is missing', () => {
    const { result } = labelOf({ runNumber: undefined, commitSha: 'a1b2c3d4e5f60718' })

    expect(result.current).toBe('a1b2c3d')
  })

  it('shows the external id when neither the run number nor the SHA exist', () => {
    const { result } = labelOf({ runNumber: undefined, commitSha: undefined, externalId: '900' })

    expect(result.current).toBe('900')
  })

  it('has no label while there is no CI run', () => {
    const { result } = labelOf(undefined)

    expect(result.current).toBeUndefined()
  })

  it('follows the CI run when it arrives later', () => {
    const { result, rerender } = renderHook(
      ({ source }: { source: CiRunSummaryRecord | undefined }) => useCiRunLabel(source),
      { initialProps: { source: undefined as CiRunSummaryRecord | undefined } },
    )

    expect(result.current).toBeUndefined()

    rerender({ source: ciRunSummary('c1', { runNumber: 7 }) })

    expect(result.current).toBe('CI #7')
  })
})
