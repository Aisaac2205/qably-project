import { describe, expect, it } from 'vitest';
import { SNIPPETS } from '../components/snippets';
import { getAllSections } from '../lib/pages';
import { en } from './en';
import { es } from './es';
import type { DocContent } from './types';

interface Locale {
  name: string;
  content: DocContent;
  onlyGithub: RegExp;
  junitAccepted: RegExp;
  perSuiteRuns: RegExp;
  staleProviderRow: RegExp;
}

const locales: Locale[] = [
  {
    name: 'en',
    content: en,
    onlyGithub: /the only repository provider supported today/i,
    junitAccepted: /answers 202 Accepted/,
    perSuiteRuns: /one run per distinct suite name/i,
    staleProviderRow: /Unsupported provider in route/i,
  },
  {
    name: 'es',
    content: es,
    onlyGithub: /el único proveedor de repositorios compatible actualmente/i,
    junitAccepted: /responde 202 Accepted/,
    perSuiteRuns: /una ejecución por cada nombre de suite distinto/i,
    staleProviderRow: /Proveedor no reconocido en la ruta/i,
  },
];

// Every string reachable from the content, whatever the page, section or block
// type, so a new page or block kind cannot hide a claim from this guard.
function collectStrings(value: unknown, parts: string[] = []): string[] {
  if (typeof value === 'string') {
    parts.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, parts);
  } else if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) collectStrings(item, parts);
  }

  return parts;
}

interface ForbiddenClaim {
  reason: string;
  pattern: RegExp;
}

// Public docs promise only what the product and the third-party tools really
// do. Each entry is a claim that was audited as false, unverifiable or a hedge.
// Widen a pattern on purpose, with a source, when a claim becomes true.
const FORBIDDEN_CLAIMS: ForbiddenClaim[] = [
  {
    reason: 'Bitbucket is not a supported repository provider',
    pattern: /bitbucket/i,
  },
  { reason: 'SOC 2 compliance is not held', pattern: /\bsoc\s?2\b/i },
  { reason: 'ISO 27001 certification is not held', pattern: /\biso[\s-]?27001\b/i },
  {
    reason: 'the docs must not tell readers to validate our own instructions',
    pattern:
      /must be validated|debe validarse|validar(se)? con la documentaci[oó]n oficial|verify the suggested|before running it in production|antes de integrarlo en entornos productivos/i,
  },
  { reason: 'Qably has no code coverage metric', pattern: /coverage|cobertura/i },
  {
    reason: 'self-hosting is neither offered nor documented',
    pattern: /self-hosted|autoalojad|instancias privadas|on-premises?/i,
  },
  {
    reason: 'nothing in Qably is promised in real time',
    pattern: /real[\s-]time|tiempo real/i,
  },
  {
    reason: 'a case identity is not the name alone: classname is part of it',
    pattern:
      /classname is ignored|determined strictly by the name|classname se descarta|exclusivamente por el atributo name/i,
  },
  {
    reason: 'PHPUnit 10 and later still write JUnit XML through --log-junit',
    pattern:
      /PHPUnit 10\+|PHPUnit 9 and earlier|PHPUnit 9 y anteriores|phpunit -c phpunit\.xml|removed it|la eliminó/i,
  },
  {
    reason: 'junit_suite_name only renames the root suite, it does not split it per file',
    pattern: /per-file granularity|granularidad por archivo/i,
  },
  {
    reason:
      'the docs are split in pages: a cross-reference names its page instead of saying "below" or "previous step"',
    pattern:
      /FAQ section below|sección de preguntas frecuentes|covered in the previous step|se detallaron en el paso anterior|described in step 2\.|de esta guía/i,
  },
];

function sectionText(content: DocContent, id: string): string {
  const section = getAllSections(content).find((candidate) => candidate.id === id);

  if (section === undefined) throw new Error(`missing docs section ${id}`);

  return collectStrings(section).join('\n');
}

describe('documentation claims', () => {
  describe.each(locales)('$name', ({ content, onlyGithub, junitAccepted, perSuiteRuns, staleProviderRow }) => {
    const strings = collectStrings(content);
    const text = strings.join('\n');

    it.each(FORBIDDEN_CLAIMS)('does not claim: $reason', ({ pattern }) => {
      const match = text.match(pattern)?.[0];

      expect(match, `found forbidden claim "${match}"`).toBeUndefined();
    });

    it('states that GitHub is the only supported repository provider', () => {
      expect(text).toMatch(onlyGithub);
    });

    it('selects the vitest junit reporter only together with an output file', () => {
      const offenders = strings.filter(
        (value) =>
          /vitest/i.test(value) && /--reporter=junit/.test(value) && !/--outputFile/.test(value),
      );

      expect(offenders).toEqual([]);
    });

    it('selects the Playwright junit reporter only together with an output file', () => {
      const offenders = strings.filter(
        (value) =>
          /playwright test/.test(value) &&
          /--reporter=junit/.test(value) &&
          !/PLAYWRIGHT_JUNIT_OUTPUT_NAME|outputFile/.test(value),
      );

      expect(offenders).toEqual([]);
    });

    it('installs go-junit-report and keeps a failing test failing the CI step', () => {
      expect(text).toContain('go install github.com/jstemmer/go-junit-report/v2@latest');
      expect(text).toMatch(/go-junit-report -set-exit-code/);
    });

    it('installs the .NET JUnit logger before running dotnet test', () => {
      expect(text).toContain('dotnet add package JUnitXml.TestLogger');
    });

    it('shows a single PHPUnit command that writes the JUnit file', () => {
      expect(text).toContain('phpunit --log-junit junit.xml');
    });

    describe('the JUnit and webhook reference', () => {
      const junit = sectionText(content, 'reference-runs-ingest-junit');
      const webhook = sectionText(content, 'reference-webhook');

      it('says the JUnit endpoint answers 202 Accepted because the runs are queued', () => {
        expect(junit).toMatch(junitAccepted);
        expect(junit).not.toMatch(/\b200\b/);
      });

      it('documents one run per suite name and its derived externalId', () => {
        expect(junit).toMatch(perSuiteRuns);
        expect(junit).toContain('<externalId>-<slug>-<hash>');
      });

      it('describes the 404 the route really returns for an unknown provider name', () => {
        expect(webhook).not.toMatch(staleProviderRow);
        expect(webhook).toContain('Unsupported provider "<value>"');
      });
    });
  });

  describe('home snippets', () => {
    it.each(Object.entries(SNIPPETS))('%s writes the junit.xml it uploads', (_id, snippet) => {
      if (/vitest/.test(snippet)) {
        expect(snippet).toMatch(/--outputFile=junit\.xml/);
      }

      if (/playwright test/.test(snippet)) {
        expect(snippet).toMatch(/PLAYWRIGHT_JUNIT_OUTPUT_NAME=junit\.xml/);
      }
    });
  });
});
