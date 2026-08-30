import type { TechKey } from '@qably/types';

export const MANIFEST_PATHS = [
  'package.json',
  'composer.json',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'pubspec.yaml',
  'requirements.txt',
  'pyproject.toml',
  'go.mod',
  'docker-compose.yml',
  'docker-compose.yaml',
] as const;

export type ManifestPath = (typeof MANIFEST_PATHS)[number];

export type RepoManifests = Partial<Record<ManifestPath, string[]>>;

function contentsOf(
  manifests: RepoManifests,
  ...kinds: ManifestPath[]
): string[] {
  return kinds.flatMap((kind) => manifests[kind] ?? []);
}

const NPM_DEPENDENCIES: Record<string, TechKey> = {
  react: 'react',
  next: 'nextjs',
  vue: 'vue',
  nuxt: 'vue',
  astro: 'astro',
  typescript: 'typescript',
  '@angular/core': 'angular',
  '@nestjs/core': 'nestjs',
  express: 'express',
  vite: 'vite',
  pg: 'postgresql',
  postgres: 'postgresql',
  mysql: 'mysql',
  mysql2: 'mysql',
  mongodb: 'mongodb',
  mongoose: 'mongodb',
  redis: 'redis',
  ioredis: 'redis',
  wrangler: 'cloudflare',
  '@cloudflare/workers-types': 'cloudflare',
  '@playwright/test': 'playwright',
  playwright: 'playwright',
  jest: 'jest',
  'ts-jest': 'jest',
  '@jest/globals': 'jest',
};

const COMPOSE_IMAGES: Record<string, TechKey> = {
  postgres: 'postgresql',
  postgis: 'postgresql',
  mysql: 'mysql',
  mariadb: 'mysql',
  mongo: 'mongodb',
  redis: 'redis',
};

const JAVA_ARTIFACTS: Record<string, TechKey> = {
  'org.postgresql': 'postgresql',
  'mysql-connector': 'mysql',
  'mongodb-driver': 'mongodb',
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

function readNpm(sources: string[], into: Set<TechKey>): void {
  const manifests = sources
    .map(parseJson)
    .filter(
      (manifest): manifest is Record<string, unknown> => manifest !== null,
    );

  if (manifests.length === 0) return;

  for (const manifest of manifests) {
    const names = [
      ...keysOf(manifest.dependencies),
      ...keysOf(manifest.devDependencies),
    ];

    for (const name of names) {
      const tech = NPM_DEPENDENCIES[name];

      if (tech !== undefined) into.add(tech);
    }
  }

  into.add(into.has('typescript') ? 'typescript' : 'javascript');
}

function readComposer(sources: string[], into: Set<TechKey>): void {
  const manifests = sources
    .map(parseJson)
    .filter(
      (manifest): manifest is Record<string, unknown> => manifest !== null,
    );

  if (manifests.length === 0) return;

  into.add('php');

  const names = manifests.flatMap((manifest) => [
    ...keysOf(manifest.require),
    ...keysOf(manifest['require-dev']),
  ]);

  if (names.some((name) => name.startsWith('laravel/'))) into.add('laravel');
}

function readJava(manifests: RepoManifests, into: Set<TechKey>): void {
  const sources = contentsOf(
    manifests,
    'pom.xml',
    'build.gradle',
    'build.gradle.kts',
  );

  if (sources.length === 0) return;

  into.add('java');

  const joined = sources.join('\n');

  if (
    joined.includes('spring-boot') ||
    joined.includes('springframework.boot')
  ) {
    into.add('springboot');
  }

  for (const [artifact, tech] of Object.entries(JAVA_ARTIFACTS)) {
    if (joined.includes(artifact)) into.add(tech);
  }
}

function readDart(sources: string[], into: Set<TechKey>): void {
  if (!sources.some((source) => /^\s*flutter\s*:/m.test(source))) return;

  into.add('flutter');
}

function readPython(manifests: RepoManifests, into: Set<TechKey>): void {
  const sources = contentsOf(manifests, 'requirements.txt', 'pyproject.toml');

  if (sources.length === 0) return;

  into.add('python');

  const joined = sources.join('\n').toLowerCase();

  if (joined.includes('django')) into.add('django');
  if (joined.includes('fastapi')) into.add('fastapi');
  if (joined.includes('psycopg')) into.add('postgresql');
  if (joined.includes('pymysql') || joined.includes('mysqlclient')) {
    into.add('mysql');
  }
  if (joined.includes('pymongo')) into.add('mongodb');
  if (/^\s*redis/m.test(joined)) into.add('redis');
}

function readGo(sources: string[], into: Set<TechKey>): void {
  if (sources.length === 0) return;

  into.add('go');

  const joined = sources.join('\n');

  if (joined.includes('lib/pq') || joined.includes('jackc/pgx')) {
    into.add('postgresql');
  }
}

function readCompose(manifests: RepoManifests, into: Set<TechKey>): void {
  const sources = contentsOf(
    manifests,
    'docker-compose.yml',
    'docker-compose.yaml',
  );

  if (sources.length === 0) return;

  into.add('docker');

  for (const line of sources.join('\n').split('\n')) {
    const match = /^\s*image:\s*["']?([\w.\-/]+)/.exec(line);

    if (match === null) continue;

    const image = match[1].split('/').pop() ?? '';

    for (const [name, tech] of Object.entries(COMPOSE_IMAGES)) {
      if (image === name || image.startsWith(`${name}-`)) into.add(tech);
    }
  }
}

export function detectStack(manifests: RepoManifests): TechKey[] {
  const detected = new Set<TechKey>();

  readNpm(contentsOf(manifests, 'package.json'), detected);
  readComposer(contentsOf(manifests, 'composer.json'), detected);
  readJava(manifests, detected);
  readDart(contentsOf(manifests, 'pubspec.yaml'), detected);
  readPython(manifests, detected);
  readGo(contentsOf(manifests, 'go.mod'), detected);
  readCompose(manifests, detected);

  return [...detected];
}
