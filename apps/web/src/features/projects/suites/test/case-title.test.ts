import { describe, it, expect } from 'vitest'
import { describeCase } from '@/features/projects/suites/lib/case-title'
import { createMockTestCase } from '@/lib/test-utils'

describe('describeCase', () => {
  it('returns the manual case name untouched', () => {
    const testCase = createMockTestCase({
      name: 'Valid login redirects to dashboard',
      executionMode: 'manual',
    })

    const result = describeCase(testCase)

    expect(result).toEqual({
      title: 'Valid login redirects to dashboard',
      path: [],
      raw: 'Valid login redirects to dashboard',
      isAutomated: false,
    })
  })

  it('humanizes an automated case from its automationKey', () => {
    const testCase = createMockTestCase({
      name: 'Redirects to dashboard on valid login',
      executionMode: 'automated',
      automationKey: 'useCreateRun > redirects to dashboard on valid login',
      automationClassName: undefined,
      automationFilePath: 'src/features/runs/hooks/use-create-run.test.ts',
    })

    const result = describeCase(testCase)

    expect(result.isAutomated).toBe(true)
    expect(result.title).toBe('Redirects to dashboard on valid login')
    expect(result.path).toEqual(['useCreateRun'])
    expect(result.raw).toBe('useCreateRun > redirects to dashboard on valid login')
  })

  it('falls back to the raw name when automationKey is missing', () => {
    const testCase = createMockTestCase({
      name: 'legacy_case_name',
      executionMode: 'automated',
      automationKey: undefined,
    })

    const result = describeCase(testCase)

    expect(result.isAutomated).toBe(true)
    expect(result.raw).toBe('legacy_case_name')
  })

  it('treats a manual run case (no technical metadata) as not automated', () => {
    const result = describeCase({ name: 'Reset password flow' })

    expect(result).toEqual({
      title: 'Reset password flow',
      path: [],
      raw: 'Reset password flow',
      isAutomated: false,
    })
  })

  it('humanizes a run case carrying technical metadata as automated', () => {
    const result = describeCase({
      name: 'useCreateRun > redirects to dashboard on valid login',
      className: 'src/features/runs/hooks/use-create-run.test.ts',
      filePath: 'src/features/runs/hooks/use-create-run.test.ts',
    })

    expect(result.isAutomated).toBe(true)
    expect(result.title).toBe('Redirects to dashboard on valid login')
    expect(result.path).toEqual(['useCreateRun'])
  })

  it('carries a parameter suffix through to the result', () => {
    const result = describeCase({
      name: 'renders the badge[manual]',
      className: 'src/components/ui/execution-mode-badge.test.tsx',
    })

    expect(result.parameter).toBe('manual')
  })
})
