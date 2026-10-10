import { describe, expect, it } from 'vitest'
import {
  automatedOfficialCase,
  manualOfficialCase,
  reportedRunCase,
  snapshotRunCase,
} from './run-case-fixtures'

describe.each([
  ['automatedOfficialCase', automatedOfficialCase],
  ['manualOfficialCase', manualOfficialCase],
])('%s', (_name, build) => {
  it('executed the library case as it stands unless a test says otherwise', () => {
    const official = build({ version: 6, steps: ['A step'] })

    expect(official.executedVersion).toBe(6)
    expect(official.documented).toBe(true)
  })

  it('derives documented from the expected result as well as the steps', () => {
    expect(build({ steps: [], expectedResult: 'A result' }).documented).toBe(true)
    expect(build({ steps: [], expectedResult: '' }).documented).toBe(false)
  })

  it('lets a test state that the library moved on after the run', () => {
    const official = build({ version: 6, executedVersion: 2, steps: [], documented: true })

    expect(official.version).toBe(6)
    expect(official.executedVersion).toBe(2)
    expect(official.documented).toBe(true)
  })

  it('lets a test state that the run executed a case with no version', () => {
    expect(build({ version: 6, executedVersion: null }).executedVersion).toBeNull()
  })
})

describe.each([
  ['reportedRunCase', reportedRunCase],
  ['snapshotRunCase', snapshotRunCase],
])('%s', (_name, build) => {
  it('carries no test case id while there is no official case, like the producer', () => {
    const fixture = build()

    expect(fixture.officialCase).toBeNull()
    expect(fixture.testCaseId).toBeNull()
  })

  it('takes the test case id from the official case it is given', () => {
    const official = manualOfficialCase({ id: 'case-42' })

    expect(build({ officialCase: official }).testCaseId).toBe('case-42')
    expect(build({ officialCase: automatedOfficialCase() }).testCaseId).toBe('case-9')
  })

  it('lets a test state the id explicitly', () => {
    expect(build({ testCaseId: 'case-7' }).testCaseId).toBe('case-7')
  })
})
