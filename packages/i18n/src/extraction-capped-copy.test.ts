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

  it('never says the extraction is paused, because nothing resumes a skipped push', () => {
    const copy = [
      dictionary.notifications.events.extraction_capped,
      dictionary.notifications.emailSubject.extraction_capped,
      dictionary.settings.notifications.events.extraction_capped,
      dictionary.settings.notifications.groups.review.description,
    ].join('\n')

    expect(copy).not.toMatch(/paus/i)
  })
})

describe('extraction_capped copy', () => {
  it('tells the reader what was skipped, the limit, and what to do about it in English', () => {
    expect(en.notifications.events.extraction_capped).toBe(
      'Proposals were not extracted from {{count}} test files because this push exceeds the limit of {{limit}} test files per push. Push fewer test files at a time to extract them.',
    )
    expect(en.notifications.emailSubject.extraction_capped).toBe(
      'Proposal extraction skipped: push too large',
    )
    expect(en.settings.notifications.events.extraction_capped).toBe(
      'Extraction skipped for large pushes',
    )
  })

  it('tells the reader what was skipped, the limit, and what to do about it in Spanish', () => {
    expect(es.notifications.events.extraction_capped).toBe(
      'No se extrajeron propuestas de {{count}} archivos de prueba porque este push supera el límite de {{limit}} archivos de prueba por push. Sube menos archivos de prueba por push para extraerlos.',
    )
    expect(es.notifications.emailSubject.extraction_capped).toBe(
      'Extracción de propuestas omitida: push demasiado grande',
    )
    expect(es.settings.notifications.events.extraction_capped).toBe(
      'Extracción omitida en pushes grandes',
    )
  })
})
