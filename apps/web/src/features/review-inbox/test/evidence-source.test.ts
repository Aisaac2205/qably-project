import { describe, expect, it } from 'vitest'
import { isChatRequestEvidence } from '@/features/review-inbox/lib/evidence-source'

describe('isChatRequestEvidence', () => {
  it('recognizes an artifact evidence whose uri points at a chat message', () => {
    expect(
      isChatRequestEvidence({ kind: 'artifact', uri: 'qably://chat/thread-1/message-2/0' }),
    ).toBe(true)
  })

  it('rejects an artifact evidence whose uri is not a chat message', () => {
    expect(
      isChatRequestEvidence({ kind: 'artifact', uri: 'mock://acme/repo/pull/1' }),
    ).toBe(false)
  })

  it('rejects a source_excerpt evidence even with a chat-looking uri', () => {
    expect(
      isChatRequestEvidence({ kind: 'source_excerpt', uri: 'qably://chat/thread-1/message-2/0' }),
    ).toBe(false)
  })

  it('rejects a url evidence', () => {
    expect(isChatRequestEvidence({ kind: 'url', uri: 'https://example.com' })).toBe(false)
  })
})
