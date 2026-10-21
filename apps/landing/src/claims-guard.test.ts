import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Guard against marketing claims the product does not back.
 *
 * Every text file under apps/landing/src, the security, privacy and terms pages
 * included, is scanned for phrases that promise something Qably does not do
 * (certifications, uptime SLAs, a payment flow, real-time telemetry, Bitbucket
 * support, an unconfirmed legal entity, retention or deletion promises, ...).
 * The docs have their own guard in features/documentation/content/claims.test.ts.
 */

const SRC_ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * Paths (relative to src, forward slashes) that this guard does not scan.
 * Do not add new entries to hide a claim.
 */
const EXCLUDED_PATHS: readonly string[] = ['features/documentation/'];

const LEGAL_PAGES: readonly string[] = [
  'pages/security.astro',
  'pages/privacy.astro',
  'pages/terms.astro',
  'pages/en/security.astro',
  'pages/en/privacy.astro',
  'pages/en/terms.astro',
];

const BINARY_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2']);

interface ForbiddenClaim {
  label: string;
  pattern: RegExp;
}

/**
 * All patterns are case-insensitive. The price-period patterns refuse a
 * leading slash so that a `// Month ...` code comment is not read as "/ month".
 */
const FORBIDDEN_CLAIMS: readonly ForbiddenClaim[] = [
  { label: 'SOC 2', pattern: /SOC 2/i },
  { label: 'ISO 27001', pattern: /ISO 27001/i },
  { label: 'Qably Inc', pattern: /Qably Inc/i },
  { label: 'Bitbucket', pattern: /Bitbucket/i },
  { label: 'tiempo real', pattern: /tiempo real/i },
  { label: 'real-time', pattern: /real-time/i },
  { label: 'real time', pattern: /real time/i },
  { label: '99.9', pattern: /99\.9/ },
  { label: 'Más elegido', pattern: /Más elegido/i },
  { label: 'Most chosen', pattern: /Most chosen/i },
  { label: 'próximamente', pattern: /próximamente/i },
  { label: 'coming soon', pattern: /coming soon/i },
  { label: '96%', pattern: /96%/ },
  { label: '50ms', pattern: /50ms/i },
  { label: '50 ms', pattern: /50 ms/i },
  { label: '/ mes', pattern: /(?<!\/)\/ mes\b/i },
  { label: '/ month', pattern: /(?<!\/)\/ month\b/i },
  { label: 'Gmail', pattern: /Gmail/i },
  { label: 'Qably 2.0', pattern: /Qably 2\.0/i },
  { label: 'GDPR', pattern: /GDPR/i },
  { label: 'CCPA', pattern: /CCPA/i },
  { label: 'SLA', pattern: /\bSLA\b/i },
  { label: 'Zero-Trust', pattern: /Zero[- ]Trust/i },
  { label: 'penetración', pattern: /penetraci[oó]n/i },
  { label: 'penetration', pattern: /penetration/i },
  { label: 'salted', pattern: /\bsalted\b/i },
  { label: 'con sal', pattern: /\bcon sal\b/i },
  { label: 'qbly_live', pattern: /qbly_live/i },
  { label: 'derecho al olvido', pattern: /derecho al olvido/i },
  { label: 'right to be forgotten', pattern: /right to be forgotten/i },
  { label: '@qably.com', pattern: /@qably\.com/i },
  { label: 'entrenar', pattern: /entrenar|entrenamiento/i },
  { label: 'train', pattern: /\btrain(s|ed|ing)?\b/i },
  { label: 'registro inmutable', pattern: /registro inmutable/i },
  { label: 'immutable', pattern: /\bimmutable\b|\binmutable\b/i },
  { label: 'TLS 1.3', pattern: /TLS 1\.3/i },
];

/**
 * Claims that only the security, privacy and terms pages must avoid. The same
 * words are legitimate elsewhere (a sample project called "Billing &
 * Subscriptions", a "90 days" chart period, the web app's own labels), so
 * these run against LEGAL_PAGES only.
 */
const LEGAL_PAGE_FORBIDDEN_CLAIMS: readonly ForbiddenClaim[] = [
  { label: '90 días', pattern: /90 d[ií]as/i },
  { label: '90 days', pattern: /90 days/i },
  { label: 'audit', pattern: /audit/i },
  { label: 'certification', pattern: /certific/i },
  { label: 'compliance', pattern: /compliance|cumplimiento/i },
  { label: 'encryption at rest', pattern: /en reposo|at rest/i },
  { label: 'subscription', pattern: /suscripci[oó]n|subscription/i },
  { label: 'invoice', pattern: /factura|invoice/i },
];

interface ScannedFile {
  relativePath: string;
  text: string;
}

function isExcluded(relativePath: string): boolean {
  if (/\.test\.[cm]?[jt]sx?$/.test(relativePath)) return true;

  return EXCLUDED_PATHS.some((excluded) =>
    excluded.endsWith('/') ? relativePath.startsWith(excluded) : relativePath === excluded,
  );
}

function collectFiles(directory: string): ScannedFile[] {
  const files: ScannedFile[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectFiles(absolutePath));
      continue;
    }

    if (BINARY_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;

    const relativePath = path.relative(SRC_ROOT, absolutePath).split(path.sep).join('/');
    if (isExcluded(relativePath)) continue;

    files.push({ relativePath, text: readFileSync(absolutePath, 'utf-8') });
  }

  return files;
}

function findOffences(files: readonly ScannedFile[], pattern: RegExp): string[] {
  const offences: string[] = [];

  for (const file of files) {
    file.text.split(/\r?\n/).forEach((line, index) => {
      if (pattern.test(line)) offences.push(`${file.relativePath}:${index + 1}  ${line.trim().slice(0, 120)}`);
    });
  }

  return offences;
}

const scannedFiles = collectFiles(SRC_ROOT);

describe('landing claims guard: scope', () => {
  it('scans the marketing copy but skips the excluded paths and test files', () => {
    const scanned = scannedFiles.map((file) => file.relativePath);

    expect(scanned).toContain('features/i18n/dictionaries/es.ts');
    expect(scanned).toContain('features/i18n/dictionaries/en.ts');
    expect(scanned).toContain('layouts/Landing.astro');
    expect(scanned).toContain('lib/i18n/en.json');
    expect(scanned.some((p) => p.startsWith('features/documentation/'))).toBe(false);
    expect(scanned.some((p) => p.endsWith('claims-guard.test.ts'))).toBe(false);
  });

  it.each(LEGAL_PAGES)('scans the legal page %s', (page) => {
    expect(scannedFiles.map((file) => file.relativePath)).toContain(page);
  });
});

describe('landing claims guard: forbidden claims', () => {
  it.each(FORBIDDEN_CLAIMS)('never contains "$label"', ({ pattern }) => {
    expect(findOffences(scannedFiles, pattern)).toEqual([]);
  });
});

describe('landing claims guard: legal and security pages', () => {
  const legalFiles = scannedFiles.filter((file) => LEGAL_PAGES.includes(file.relativePath));

  it('finds all six pages', () => {
    expect(legalFiles).toHaveLength(LEGAL_PAGES.length);
  });

  it.each(LEGAL_PAGE_FORBIDDEN_CLAIMS)('never contains "$label"', ({ pattern }) => {
    expect(findOffences(legalFiles, pattern)).toEqual([]);
  });
});
