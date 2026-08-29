import type { TechKey } from '@qably/types';

export const MANIFEST_PATHS = [
  'package.json',
  'composer.json',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'pubspec.yaml',
] as const;

export type ManifestPath = (typeof MANIFEST_PATHS)[number];

export type RepoManifests = Partial<Record<ManifestPath, string>>;

const NPM_DEPENDENCIES: Record<string, TechKey> = {
  react: 'react',
  typescript: 'typescript',
  '@angular/core': 'angular',
  '@nestjs/core': 'nestjs',
  express: 'express',
  vite: 'vite',
  pg: 'postgresql',
  wrangler: 'cloudflare',
  '@cloudflare/workers-types': 'cloudflare',
};

function parseJson(raw: string | undefined): Record<string, unknown> | null {
  if (raw === undefined) return null;

  try {
    const parsed: unknown = JSON.parse(raw);

    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function keysOf(value: unknown): string[] {
  return typeof value === 'object' && value !== null ? Object.keys(value) : [];
}

function readNpm(raw: string | undefined, into: Set<TechKey>): void {
  const manifest = parseJson(raw);

  if (manifest === null) return;

  const names = [
    ...keysOf(manifest.dependencies),
    ...keysOf(manifest.devDependencies),
  ];

  for (const name of names) {
    const tech = NPM_DEPENDENCIES[name];

    if (tech !== undefined) into.add(tech);
  }

  into.add(into.has('typescript') ? 'typescript' : 'javascript');
}

function readComposer(raw: string | undefined, into: Set<TechKey>): void {
  const manifest = parseJson(raw);

  if (manifest === null) return;

  into.add('php');

  const names = [
    ...keysOf(manifest.require),
    ...keysOf(manifest['require-dev']),
  ];

  if (names.some((name) => name.startsWith('laravel/'))) into.add('laravel');
}

function readJava(manifests: RepoManifests, into: Set<TechKey>): void {
  const sources = [
    manifests['pom.xml'],
    manifests['build.gradle'],
    manifests['build.gradle.kts'],
  ].filter((source): source is string => source !== undefined);

  if (sources.length === 0) return;

  into.add('java');

  if (sources.some((source) => source.includes('spring-boot'))) {
    into.add('springboot');
  }

  if (sources.some((source) => source.includes('springframework.boot'))) {
    into.add('springboot');
  }
}

function readDart(raw: string | undefined, into: Set<TechKey>): void {
  if (raw === undefined) return;
  if (!/^\s*flutter\s*:/m.test(raw)) return;

  into.add('flutter');
}

export function detectStack(manifests: RepoManifests): TechKey[] {
  const detected = new Set<TechKey>();

  readNpm(manifests['package.json'], detected);
  readComposer(manifests['composer.json'], detected);
  readJava(manifests, detected);
  readDart(manifests['pubspec.yaml'], detected);

  return [...detected];
}
