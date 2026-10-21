import { describe, expect, it } from 'vitest'
import { en, es } from './index'

const LOCALES = { en, es }

describe.each(Object.entries(LOCALES))('extraction_capped copy (%s)', (_name, dictionary) => {
  it('has a message that names how many files were skipped and the limit that was exceeded', () => {
    const { events } = dictionary.notifications

    expect(events.extraction_capped).toContain('{{count}}')
    expect(events.extraction_capped).toContain('{{limit}}')
  })

  it('has an email subject', () => {
    expect(dictionary.notifications.emailSubject.extraction_capped).toBeTruthy()
  })

  it('has a preference label under the review group', () => {
    expect(dictionary.settings.notifications.events.extraction_capped).toBeTruthy()
  })
})

describe('extraction_capped copy', () => {
  it('reads as plain Spanish and English sentences', () => {
    expect(en.notifications.events.extraction_capped).toBe(
      'Proposals were not extracted from {{count}} test files because the push exceeds the limit of {{limit}}.',
    )
    expect(es.notifications.events.extraction_capped).toBe(
      'No se extrajeron propuestas de {{count}} archivos de prueba porque el push supera el límite de {{limit}}.',
    )
  })
})
