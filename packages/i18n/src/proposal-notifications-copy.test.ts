import { describe, expect, it } from 'vitest'
import { en, es } from './index'

const LOCALES = { en, es }

describe.each(Object.entries(LOCALES))('notifications panel copy (%s)', (_name, dictionary) => {
  const { notifications } = dictionary

  it('words the empty read tab and the unread state of a row', () => {
    expect(notifications.emptyRead.trim()).not.toBe('')
    expect(notifications.unreadState.trim()).not.toBe('')
  })

  it('keeps those labels free of placeholders and plural forms', () => {
    expect(notifications.emptyRead).not.toContain('{{')
    expect(notifications.unreadState).not.toContain('{{')
  })

  it('still has the severity labels the panel renders for every severity', () => {
    for (const label of [
      notifications.severityCritical,
      notifications.severityHigh,
      notifications.severityMedium,
      notifications.severityLow,
    ]) {
      expect(label.trim()).not.toBe('')
    }
  })
})

describe.each(Object.entries(LOCALES))('review inbox batch filter copy (%s)', (_name, dictionary) => {
  const { reviewInbox } = dictionary

  it('labels the chip and the control that removes it', () => {
    expect(reviewInbox.batchFilter.trim()).not.toBe('')
    expect(reviewInbox.clearBatchFilter.trim()).not.toBe('')
  })

  it('keeps the chip label free of placeholders, since the id is rendered next to it', () => {
    expect(reviewInbox.batchFilter).not.toContain('{{')
  })
})

describe('proposal notifications copy across languages', () => {
  it('translates the new labels instead of repeating the English ones', () => {
    expect(es.notifications.emptyRead).not.toBe(en.notifications.emptyRead)
    expect(es.notifications.unreadState).not.toBe(en.notifications.unreadState)
    expect(es.reviewInbox.batchFilter).not.toBe(en.reviewInbox.batchFilter)
    expect(es.reviewInbox.clearBatchFilter).not.toBe(en.reviewInbox.clearBatchFilter)
  })
})
