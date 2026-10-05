import { describe, expect, it } from 'vitest'
import {
  automatedOfficialCase,
  manualOfficialCase,
  reportedRunCase,
  snapshotRunCase,
} from './run-case-fixtures'

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
