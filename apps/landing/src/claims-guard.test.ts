import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Guard against marketing claims the product does not back.
 *
 * Every text file under apps/landing/src is scanned for phrases that promise
 * something Qably does not do (certifications, uptime SLAs, a payment flow,
 * real-time telemetry, Bitbucket support, an unconfirmed legal entity, ...).
 * The docs have their own guard in features/documentation/content/claims.test.ts.
 */

const SRC_ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * Paths (relative to src, forward slashes) that this guard does not scan.
 * TEMPORARY: the legal and security pages are rewritten in a later task of the
 * landing-docs-redesign feature, which must delete the page entries below so
 * they fall under this guard too. Do not add new entries to hide a claim.
 */
const EXCLUDED_PATHS: readonly string[] = [
  'features/documentation/',
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
    expect(scanned.some((p) => p === 'pages/security.astro')).toBe(false);
    expect(scanned.some((p) => p.endsWith('claims-guard.test.ts'))).toBe(false);
  });
});

describe('landing claims guard: forbidden claims', () => {
  it.each(FORBIDDEN_CLAIMS)('never contains "$label"', ({ pattern }) => {
    expect(findOffences(scannedFiles, pattern)).toEqual([]);
  });
});
