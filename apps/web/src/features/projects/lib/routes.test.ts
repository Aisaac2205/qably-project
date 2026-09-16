import { describe, expect, it } from 'vitest'
import {
  projectQualityPath,
  projectRootPath,
  projectRunPath,
  projectSuitesPath,
  reviewInboxProposalPath,
  suiteEditCasePath,
  suiteEditNewCasePath,
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

describe('suiteEditNewCasePath', () => {
  it('points at the suite edit page with a new-case draft preselected', () => {
    expect(suiteEditNewCasePath('proj-1', 'suite-1')).toBe(
      '/projects/proj-1/suites/suite-1/edit?case=new',
    )
  })
})

describe('suiteEditCasePath', () => {
  it('points at the suite edit page with an existing case preselected', () => {
    expect(suiteEditCasePath('proj-1', 'suite-1', 'case-1')).toBe(
      '/projects/proj-1/suites/suite-1/edit?case=case-1',
    )
  })
})
