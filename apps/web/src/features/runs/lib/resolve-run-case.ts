import type { RunCaseOfficialCase, RunCaseRecord, RunSource } from '@qably/types'
import { describeCase } from '@/features/projects/suites/lib/case-title'

export interface ResolvedRunCase {
  readonly title: string
  readonly rawName?: string
  readonly steps: readonly string[]
  readonly expectedResult: string
  readonly version?: number
  readonly showAerisAction: boolean
}

function differsFromTitle(rawName: string, title: string): boolean {
  return rawName.trim().toLowerCase() !== title.trim().toLowerCase()
}

function describeOfficialCase(official: RunCaseOfficialCase) {
  return describeCase({
    name: official.name,
    executionMode: official.executionMode,
    ...(official.automationKey === undefined ? {} : { automationKey: official.automationKey }),
    ...(official.automationClassName === undefined
      ? {}
      : { automationClassName: official.automationClassName }),
    ...(official.automationFilePath === undefined
      ? {}
      : { automationFilePath: official.automationFilePath }),
  })
}

function withRawName(
  c: RunCaseRecord,
  title: string,
): Pick<ResolvedRunCase, 'rawName'> {
  return differsFromTitle(c.name, title) ? { rawName: c.name } : {}
}

export function resolveRunCase(c: RunCaseRecord, source: RunSource): ResolvedRunCase {
  const official = c.officialCase

  if (source === 'manual' || official === null) {
    const { title } = describeCase(c)
    return {
      title,
      ...withRawName(c, title),
      steps: c.steps,
      expectedResult: c.expectedResult,
      showAerisAction: false,
    }
  }

  const { title } = describeOfficialCase(official)
  return {
    title,
    ...withRawName(c, title),
    steps: official.steps,
    expectedResult: official.expectedResult,
    ...(official.version === null ? {} : { version: official.version }),
    showAerisAction:
      official.executionMode === 'automated' &&
      official.steps.length === 0 &&
      official.expectedResult === '',
  }
}
