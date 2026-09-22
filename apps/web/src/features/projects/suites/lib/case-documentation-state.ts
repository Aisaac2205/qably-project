import type { CaseDocumentationField, DocumentFilesSkipReason, TestCase } from '@qably/types'
import { isDocumenting } from './documentation-state'

const KNOWN_SKIP_REASONS: readonly DocumentFilesSkipReason[] = [
  'no-source-file',
  'no-automation-key',
  'already-pending',
  'human-documented',
]

export type CaseDocumentationSkipReason = DocumentFilesSkipReason | 'unknown'

export type CaseDocumentationBadge =
  | { kind: 'documenting' }
  | { kind: 'incomplete'; missing: CaseDocumentationField[] }
  | { kind: 'skipped'; reason: CaseDocumentationSkipReason | null }
  | { kind: 'failed' }

function normalizeSkipReason(reason: string | null): CaseDocumentationSkipReason | null {
  if (reason === null) return null
  return (KNOWN_SKIP_REASONS as readonly string[]).includes(reason)
    ? (reason as DocumentFilesSkipReason)
    : 'unknown'
}

export function deriveCaseDocumentationBadge(testCase: TestCase): CaseDocumentationBadge | null {
  const documentation = testCase.documentation
  if (documentation === undefined) return null

  if (isDocumenting(documentation)) return { kind: 'documenting' }
  if (documentation.outcome === 'incomplete') {
    return { kind: 'incomplete', missing: documentation.missing }
  }
  if (documentation.outcome === 'skipped') {
    return { kind: 'skipped', reason: normalizeSkipReason(documentation.skipReason) }
  }
  if (documentation.outcome === 'failed') return { kind: 'failed' }

  return null
}
