import { describe, expect, it } from 'vitest'
import type { RunSource } from '@qably/types'
import { resolveRunCase } from '@/features/runs/lib/resolve-run-case'
import {
  CI_HUMANIZED_TITLE,
  CI_RAW_NAME,
  automatedOfficialCase,
  manualOfficialCase,
  reportedRunCase,
  snapshotRunCase,
} from './run-case-fixtures'

const AUTOMATED_SOURCES: RunSource[] = ['api', 'github_actions']

describe('resolveRunCase in a manual run', () => {
  it('renders the snapshot title, steps and expected result', () => {
    const resolved = resolveRunCase(snapshotRunCase(), 'manual')

    expect(resolved.title).toBe('Valid login redirects to dashboard')
    expect(resolved.steps).toEqual(['Navigate to /login', 'Click Sign in'])
    expect(resolved.expectedResult).toBe('Redirected to /dashboard')
    expect(resolved.rawName).toBeUndefined()
  })

  it('keeps the snapshot even when the library case was documented afterwards', () => {
    const resolved = resolveRunCase(
      snapshotRunCase({
        officialCase: manualOfficialCase({
          name: 'Otro título',
          steps: ['Paso nuevo'],
          expectedResult: 'Resultado nuevo',
        }),
      }),
      'manual',
    )

    expect(resolved.title).toBe('Valid login redirects to dashboard')
    expect(resolved.steps).toEqual(['Navigate to /login', 'Click Sign in'])
    expect(resolved.expectedResult).toBe('Redirected to /dashboard')
  })

  it('never shows a version', () => {
    const resolved = resolveRunCase(
      snapshotRunCase({ officialCase: manualOfficialCase({ version: 4 }) }),
      'manual',
    )

    expect(resolved.version).toBeUndefined()
  })

  it('never offers Aeris, even for an undocumented automated official case', () => {
    const resolved = resolveRunCase(
      snapshotRunCase({
        steps: [],
        expectedResult: '',
        officialCase: automatedOfficialCase(),
      }),
      'manual',
    )

    expect(resolved.showAerisAction).toBe(false)
  })
})

describe.each(AUTOMATED_SOURCES)('resolveRunCase in a %s run with an official case', (source) => {
  it('uses the library title, steps and expected result', () => {
    const resolved = resolveRunCase(
      reportedRunCase({
        officialCase: automatedOfficialCase({
          version: 2,
          steps: ['Abrir el formulario', 'Enviar credenciales'],
          expectedResult: 'Se redirige al panel',
        }),
      }),
      source,
    )

    expect(resolved.title).toBe('Redirige al panel con credenciales válidas')
    expect(resolved.steps).toEqual(['Abrir el formulario', 'Enviar credenciales'])
    expect(resolved.expectedResult).toBe('Se redirige al panel')
  })

  it('ignores the snapshot the reporter left on the run case', () => {
    const resolved = resolveRunCase(
      reportedRunCase({
        steps: ['stale step'],
        expectedResult: 'stale result',
        officialCase: automatedOfficialCase({ steps: ['Paso oficial'], expectedResult: 'Oficial' }),
      }),
      source,
    )

    expect(resolved.steps).toEqual(['Paso oficial'])
    expect(resolved.expectedResult).toBe('Oficial')
  })

  it('keeps the reporter raw name as the secondary line when it differs from the title', () => {
    const resolved = resolveRunCase(
      reportedRunCase({ officialCase: automatedOfficialCase() }),
      source,
    )

    expect(resolved.rawName).toBe(CI_RAW_NAME)
  })

  it('hides the raw name when it only differs by case and surrounding spaces', () => {
    const resolved = resolveRunCase(
      reportedRunCase({
        name: '  redirects to dashboard  ',
        officialCase: automatedOfficialCase({ name: 'Redirects To Dashboard' }),
      }),
      source,
    )

    expect(resolved.rawName).toBeUndefined()
  })

  it('shows the published version of the library case', () => {
    const resolved = resolveRunCase(
      reportedRunCase({ officialCase: automatedOfficialCase({ version: 2 }) }),
      source,
    )

    expect(resolved.version).toBe(2)
  })

  it('shows no version while the library case has no published version', () => {
    const resolved = resolveRunCase(
      reportedRunCase({ officialCase: automatedOfficialCase({ version: null }) }),
      source,
    )

    expect(resolved.version).toBeUndefined()
  })

  it('offers Aeris when the automated library case has neither steps nor expected result', () => {
    const resolved = resolveRunCase(
      reportedRunCase({ officialCase: automatedOfficialCase() }),
      source,
    )

    expect(resolved.showAerisAction).toBe(true)
  })

  it('does not offer Aeris once the library case has steps', () => {
    const resolved = resolveRunCase(
      reportedRunCase({ officialCase: automatedOfficialCase({ steps: ['Paso'] }) }),
      source,
    )

    expect(resolved.showAerisAction).toBe(false)
  })

  it('does not offer Aeris once the library case has an expected result', () => {
    const resolved = resolveRunCase(
      reportedRunCase({ officialCase: automatedOfficialCase({ expectedResult: 'Resultado' }) }),
      source,
    )

    expect(resolved.showAerisAction).toBe(false)
  })

  it('does not offer Aeris for a manual library case', () => {
    const resolved = resolveRunCase(
      reportedRunCase({
        officialCase: manualOfficialCase({ steps: [], expectedResult: '' }),
      }),
      source,
    )

    expect(resolved.showAerisAction).toBe(false)
  })

  it('falls back to the humanized automation key when the library name is blank', () => {
    const resolved = resolveRunCase(
      reportedRunCase({ officialCase: automatedOfficialCase({ name: '' }) }),
      source,
    )

    expect(resolved.title).toBe(CI_HUMANIZED_TITLE)
  })
})

describe.each(AUTOMATED_SOURCES)('resolveRunCase in a %s run without an official case', (source) => {
  it('humanizes the reported name and keeps the raw name underneath', () => {
    const resolved = resolveRunCase(reportedRunCase(), source)

    expect(resolved.title).toBe(CI_HUMANIZED_TITLE)
    expect(resolved.rawName).toBe(CI_RAW_NAME)
  })

  it('hides the raw name when it only differs by case', () => {
    const resolved = resolveRunCase(
      reportedRunCase({
        name: 'login',
        className: undefined,
        filePath: undefined,
      }),
      source,
    )

    expect(resolved.title.toLowerCase()).toBe('login')
    expect(resolved.rawName).toBeUndefined()
  })

  it('reads the snapshot, shows no version and never offers Aeris', () => {
    const resolved = resolveRunCase(
      reportedRunCase({ steps: ['Paso reportado'], expectedResult: 'Resultado reportado' }),
      source,
    )

    expect(resolved.steps).toEqual(['Paso reportado'])
    expect(resolved.expectedResult).toBe('Resultado reportado')
    expect(resolved.version).toBeUndefined()
    expect(resolved.showAerisAction).toBe(false)
  })
})
