import type { CaseDocumentationField, DocumentFilesSkipReason, TestCase } from '@qably/types'
import { isDocumenting } from './documentation-state'

export type CaseDocumentationBadge =
  | { kind: 'documenting' }
  | { kind: 'incomplete'; missing: CaseDocumentationField[] }
  | { kind: 'skipped'; reason: DocumentFilesSkipReason | null }
  | { kind: 'failed' }

export function deriveCaseDocumentationBadge(testCase: TestCase): CaseDocumentationBadge | null {
  const documentation = testCase.documentation
  if (documentation === undefined) return null

  if (isDocumenting(documentation)) return { kind: 'documenting' }
  if (documentation.outcome === 'incomplete') {
    return { kind: 'incomplete', missing: documentation.missing }
  }
  if (documentation.outcome === 'skipped') {
    return { kind: 'skipped', reason: documentation.skipReason as DocumentFilesSkipReason | null }
  }
  if (documentation.outcome === 'failed') return { kind: 'failed' }

  return null
}
