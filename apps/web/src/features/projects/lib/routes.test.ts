import { describe, expect, it } from 'vitest'
import {
  projectQualityPath,
  projectRootPath,
  projectRunPath,
  projectSuitesPath,
  reviewInboxProposalPath,
} from './routes'

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

describe('projectRunPath', () => {
  it('builds the run detail route for a project', () => {
    expect(projectRunPath('proj-1', 'run-1')).toBe('/projects/proj-1/runs/run-1')
  })
})

describe('reviewInboxProposalPath', () => {
  it('builds the review inbox route preselecting a proposal', () => {
    expect(reviewInboxProposalPath('proposal-1')).toBe('/review-inbox?proposal=proposal-1')
  })
})
