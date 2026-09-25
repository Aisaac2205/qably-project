export interface ScalarFieldDiff {
  field: 'title' | 'objective' | 'expectedResult'
  previous: string
  next: string
}

export interface ListFieldDiff {
  field: 'preconditions' | 'steps'
  added: string[]
  removed: string[]
}

export interface PublishedVersionDiff {
  scalarChanges: ScalarFieldDiff[]
  listChanges: ListFieldDiff[]
  hasChanges: boolean
}

export interface DiffableProposalFields {
  title: string
  objective: string
  preconditions: string[]
  steps: string[]
  expectedResult: string
}

function diffList(field: 'preconditions' | 'steps', previous: string[], next: string[]): ListFieldDiff | null {
  const previousSet = new Set(previous)
  const nextSet = new Set(next)
  const added = next.filter((item) => !previousSet.has(item))
  const removed = previous.filter((item) => !nextSet.has(item))
  if (added.length === 0 && removed.length === 0) return null
  return { field, added, removed }
}

export function diffAgainstPublishedVersion(
  proposal: DiffableProposalFields,
  published: DiffableProposalFields | null,
): PublishedVersionDiff | null {
  if (published === null) return null

  const scalarChanges: ScalarFieldDiff[] = []
  if (proposal.title !== published.title) {
    scalarChanges.push({ field: 'title', previous: published.title, next: proposal.title })
  }
  if (proposal.objective !== published.objective) {
    scalarChanges.push({ field: 'objective', previous: published.objective, next: proposal.objective })
  }
  if (proposal.expectedResult !== published.expectedResult) {
    scalarChanges.push({
      field: 'expectedResult',
      previous: published.expectedResult,
      next: proposal.expectedResult,
    })
  }

  const listChanges: ListFieldDiff[] = []
  const preconditionsDiff = diffList('preconditions', published.preconditions, proposal.preconditions)
  if (preconditionsDiff) listChanges.push(preconditionsDiff)
  const stepsDiff = diffList('steps', published.steps, proposal.steps)
  if (stepsDiff) listChanges.push(stepsDiff)

  return {
    scalarChanges,
    listChanges,
    hasChanges: scalarChanges.length > 0 || listChanges.length > 0,
  }
}
