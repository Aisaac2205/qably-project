import { describe, it, expect } from 'vitest'
import { mockProjects, mockSuites, mockRun, mockAiCases, mockRuns } from '@/lib/mock-data'

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

  // ── Suite enrichment assertions ──────────────────────────────────

  it('every mock suite has a description string', () => {
    mockSuites.forEach((s) => {
      expect(typeof s.description).toBe('string')
      expect(s.description.length).toBeGreaterThan(0)
    })
  })

  it('every mock suite has a tags array', () => {
    mockSuites.forEach((s) => {
      expect(Array.isArray(s.tags)).toBe(true)
      s.tags.forEach((t) => {
        expect(typeof t).toBe('string')
        expect(t).toBe(t.toLowerCase())
        expect(t).not.toMatch(/\s/)
      })
    })
  })

  it('every mock suite has isDefault boolean', () => {
    mockSuites.forEach((s) => {
      expect(typeof s.isDefault).toBe('boolean')
    })
  })

  it('every mock suite has updatedAt ISO timestamp', () => {
    mockSuites.forEach((s) => {
      expect(typeof s.updatedAt).toBe('string')
      expect(Number.isFinite(new Date(s.updatedAt).getTime())).toBe(true)
    })
  })

  it('exactly one suite per project is the default', () => {
    const byProject = new Map<string, number>()
    mockSuites.forEach((s) => {
      if (s.isDefault) {
        byProject.set(s.projectId, (byProject.get(s.projectId) ?? 0) + 1)
      }
    })
    byProject.forEach((count) => {
      expect(count).toBe(1)
    })
  })
})
