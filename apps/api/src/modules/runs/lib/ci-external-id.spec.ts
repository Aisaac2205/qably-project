import { parseCiRunExternalId } from './ci-external-id';

describe('parseCiRunExternalId', () => {
  it.each([
    ['gha-900-api-junit-unit-xml-ab12cd34', '900'],
    ['gha-900-api-junit-xml-ab12cd34-p2', '900'],
    ['gha-18446744073-web-junit-xml-cd34ef56', '18446744073'],
    ['gha-900-Build-API-junit-unit-xml-3425dd6f', '900'],
  ])('extracts the numeric run id from %s', (externalId, expected) => {
    expect(parseCiRunExternalId(externalId)).toBe(expected);
  });

  it.each<string | null | undefined>([
    'gha-local-job-junit-xml-ab12cd34',
    'gha-abc-api-junit-xml-ab12cd34',
    'gha-900',
    'run-900-api',
    '900',
    '',
    null,
    undefined,
  ])('returns undefined for %s', (externalId) => {
    expect(parseCiRunExternalId(externalId)).toBeUndefined();
  });
});
