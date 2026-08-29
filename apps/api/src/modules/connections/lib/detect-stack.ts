import type { TechKey } from '@qably/types';

const DEPENDENCY_MAP: Record<string, TechKey> = {
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

interface PackageManifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

function readDependencyNames(manifest: PackageManifest): string[] {
  return [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ];
}

export function detectStack(payload: unknown): TechKey[] {
  if (typeof payload !== 'object' || payload === null) return [];

  const names = readDependencyNames(payload);

  if (names.length === 0) return [];

  const detected = new Set<TechKey>();

  for (const name of names) {
    const tech = DEPENDENCY_MAP[name];

    if (tech !== undefined) detected.add(tech);
  }

  if (!detected.has('typescript')) detected.add('javascript');

  return [...detected];
}
