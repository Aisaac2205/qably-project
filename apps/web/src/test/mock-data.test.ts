import { describe, it, expect } from 'vitest'
import { mockProjects, mockRun, mockAiCases } from '@/lib/mock-data'

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
})
