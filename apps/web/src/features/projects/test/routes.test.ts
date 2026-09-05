import { describe, it, expect } from 'vitest'
import {
  PROJECT_ROOT_SECTION,
  projectRootPath,
  projectSuitesPath,
} from '@/features/projects/lib/routes'

describe('project routes', () => {
  it('resolves the project root to the repository section', () => {
    expect(PROJECT_ROOT_SECTION).toBe('repository')
    expect(projectRootPath('proj-1')).toBe('/projects/proj-1/repository')
  })

  it('keeps the test library addressable on its own path', () => {
    expect(projectSuitesPath('proj-1')).toBe('/projects/proj-1/suites')
  })

  it('does not collapse the two sections onto the same path', () => {
    expect(projectRootPath('proj-1')).not.toBe(projectSuitesPath('proj-1'))
  })
})
