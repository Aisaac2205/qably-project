import { describe, expect, it } from 'vitest'
import { en, es } from './index'

const LOCALES = { en, es }

describe.each(Object.entries(LOCALES))('proposals_ready copy (%s)', (_name, dictionary) => {
  it('has a singular and a plural message that both carry the batch count', () => {
    const { events } = dictionary.notifications

    expect(events.proposals_ready_one).toContain('{{count}}')
    expect(events.proposals_ready_other).toContain('{{count}}')
    expect(events.proposals_ready_one).not.toBe(events.proposals_ready_other)
  })

  it('has a singular and a plural email subject that both carry the batch count', () => {
    const { emailSubject } = dictionary.notifications

    expect(emailSubject.proposals_ready_one).toContain('{{count}}')
    expect(emailSubject.proposals_ready_other).toContain('{{count}}')
  })

  it('has a preference label and a preference group for the review inbox', () => {
    const { events, groups } = dictionary.settings.notifications

    expect(events.proposals_ready).toBeTruthy()
    expect(groups.review.title).toBeTruthy()
    expect(groups.review.description).toBeTruthy()
  })
})
