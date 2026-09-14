import { describe, it, expect } from 'vitest'
import {
  PROJECT_ROOT_SECTION,
  projectAerisPath,
  projectRootPath,
  projectSuitesPath,
  reviewInboxPath,
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

  it('points the project chat at its own full-page route', () => {
    expect(projectAerisPath('proj-1')).toBe('/projects/proj-1/aeris')
  })

  it('scopes the review inbox to a project with a query filter', () => {
    expect(reviewInboxPath('proj-1')).toBe('/review-inbox?project=proj-1')
  })
})
