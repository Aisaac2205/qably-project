import type { Evidence } from '@qably/types'

const CHAT_URI_PREFIX = 'qably://chat/'

export function isChatRequestEvidence(evidence: Pick<Evidence, 'kind' | 'uri'>): boolean {
  return evidence.kind === 'artifact' && evidence.uri.startsWith(CHAT_URI_PREFIX)
}
