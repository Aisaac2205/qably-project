import { describe, it, expect } from 'vitest'
import { mockProjects, mockSuites, mockAiCases } from '@/lib/mock-data'

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

  it('ai cases have sourceSnippet', () => {
    mockAiCases.forEach(c => {
      expect(c).toHaveProperty('sourceSnippet')
      expect(c).toHaveProperty('reviewStatus')
    })
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
