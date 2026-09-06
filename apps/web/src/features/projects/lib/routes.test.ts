import { describe, expect, it } from 'vitest'
import { projectQualityPath, projectRootPath, projectSuitesPath } from './routes'

describe('projectQualityPath', () => {
  it('builds the quality route for a project', () => {
    expect(projectQualityPath('proj-1')).toBe('/projects/proj-1/quality')
  })
})

describe('existing project route helpers', () => {
  it('keeps building the repository and suites routes', () => {
    expect(projectRootPath('proj-1')).toBe('/projects/proj-1/repository')
    expect(projectSuitesPath('proj-1')).toBe('/projects/proj-1/suites')
  })
})
