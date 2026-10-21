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

describe.each(Object.entries(LOCALES))('proposal batch toast copy (%s)', (_name, dictionary) => {
  const { toast } = dictionary.notifications

  it('has a singular and a plural title for every source, each carrying the count', () => {
    for (const title of [
      toast.proposalsPush_one,
      toast.proposalsPush_other,
      toast.proposalsDocumentation_one,
      toast.proposalsDocumentation_other,
      toast.proposalsChat_one,
      toast.proposalsChat_other,
    ]) {
      expect(title).toContain('{{count}}')
    }
    expect(toast.proposalsPush_one).not.toBe(toast.proposalsPush_other)
  })

  it('names the commit in the push title and nowhere else', () => {
    expect(toast.proposalsPush_one).toContain('{{sha}}')
    expect(toast.proposalsPush_other).toContain('{{sha}}')
    expect(toast.proposalsDocumentation_other).not.toContain('{{sha}}')
    expect(toast.proposalsChat_other).not.toContain('{{sha}}')
  })

  it('labels the action that opens the batch', () => {
    expect(toast.view.trim()).not.toBe('')
  })
})

describe.each(Object.entries(LOCALES))('review inbox badge copy (%s)', (_name, dictionary) => {
  it('has a singular and a plural phrase for the link name, each carrying the count', () => {
    const { sidebar } = dictionary

    expect(sidebar.reviewInboxPending_one).toContain('{{count}}')
    expect(sidebar.reviewInboxPending_other).toContain('{{count}}')
    expect(sidebar.reviewInboxPending_one).not.toBe(sidebar.reviewInboxPending_other)
  })
})

describe('proposal notifications copy across languages', () => {
  it('translates the new labels instead of repeating the English ones', () => {
    expect(es.notifications.emptyRead).not.toBe(en.notifications.emptyRead)
    expect(es.notifications.unreadState).not.toBe(en.notifications.unreadState)
    expect(es.reviewInbox.batchFilter).not.toBe(en.reviewInbox.batchFilter)
    expect(es.reviewInbox.clearBatchFilter).not.toBe(en.reviewInbox.clearBatchFilter)
    expect(es.notifications.toast.view).not.toBe(en.notifications.toast.view)
    expect(es.notifications.toast.proposalsPush_other).not.toBe(
      en.notifications.toast.proposalsPush_other,
    )
    expect(es.sidebar.reviewInboxPending_other).not.toBe(en.sidebar.reviewInboxPending_other)
  })
})
