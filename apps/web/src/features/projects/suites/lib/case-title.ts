import { humanizeTestName } from '@qably/test-naming'

export interface CaseTitleInput {
  readonly name: string
  readonly executionMode?: 'manual' | 'automated'
  readonly automationKey?: string
  readonly automationClassName?: string
  readonly automationFilePath?: string
  readonly className?: string
  readonly filePath?: string
}

export interface DescribedCase {
  readonly title: string
  readonly path: readonly string[]
  readonly raw: string
  readonly parameter?: string
  readonly isAutomated: boolean
}

function resolveIsAutomated(input: CaseTitleInput): boolean {
  if (input.executionMode !== undefined) {
    return input.executionMode === 'automated'
  }
  return (
    input.automationKey !== undefined ||
    input.className !== undefined ||
    input.filePath !== undefined
  )
}

export function describeCase(input: CaseTitleInput): DescribedCase {
  const isAutomated = resolveIsAutomated(input)

  if (!isAutomated) {
    return { title: input.name, path: [], raw: input.name, isAutomated: false }
  }

  const raw = input.automationKey ?? input.name
  const className = input.automationClassName ?? input.className
  const filePath = input.automationFilePath ?? input.filePath
  const humanized = humanizeTestName({ name: raw, className, filePath })

  return humanized.parameter === undefined
    ? { title: humanized.title, path: humanized.path, raw: humanized.raw, isAutomated: true }
    : {
        title: humanized.title,
        path: humanized.path,
        raw: humanized.raw,
        parameter: humanized.parameter,
        isAutomated: true,
      }
}
