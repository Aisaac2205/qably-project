import { describe, it, expect } from 'vitest'
import { mockProjects, mockRun, mockAiCases, mockRuns } from '@/lib/mock-data'

describe('mock data', () => {
  it('provides at least 2 projects', () => {
    expect(mockProjects.length).toBeGreaterThanOrEqual(2)
  })

  it('each project has required fields', () => {
    mockProjects.forEach(p => {
      expect(p).toHaveProperty('id')
      expect(p).toHaveProperty('name')
      expect(p).toHaveProperty('healthScore')
      expect(p).toHaveProperty('lastRunStatus')
    })
  })

  it('run has cases array', () => {
    expect(Array.isArray(mockRun.cases)).toBe(true)
    expect(mockRun.cases.length).toBeGreaterThan(0)
  })

  it('each case has status field', () => {
    mockRun.cases.forEach(c => {
      expect(['pass', 'fail', 'skip', 'blocked', 'running', 'pending']).toContain(c.status)
    })
  })

  it('ai cases have sourceSnippet', () => {
    mockAiCases.forEach(c => {
      expect(c).toHaveProperty('sourceSnippet')
      expect(c).toHaveProperty('reviewStatus')
    })
  })

  it('run-10 (github_actions) has CI metadata', () => {
    const run10 = mockRuns.find(r => r.id === 'run-10')
    expect(run10).toBeDefined()
    expect(run10!.source).toBe('github_actions')
    // CI metadata must be populated for github_actions runs
    expect(run10!.commitSha).toBe('b1e4d90')
    expect(run10!.commitMessage).toBe('fix: checkout button not disabling on empty cart')
    expect(run10!.branch).toBe('feature/checkout-fix')
    expect(run10!.workflowName).toBe('CI')
    expect(run10!.commitAuthor).toEqual({ name: 'CI Bot', email: 'ci@qably.io' })
  })

  it('run-9 (api) has no CI metadata', () => {
    const run9 = mockRuns.find(r => r.id === 'run-9')
    expect(run9).toBeDefined()
    expect(run9!.source).toBe('api')
    expect(run9!.commitSha).toBeUndefined()
    expect(run9!.commitMessage).toBeUndefined()
    expect(run9!.branch).toBeUndefined()
  })
})
