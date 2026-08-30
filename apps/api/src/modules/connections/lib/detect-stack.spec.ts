import { MANIFEST_PATHS, detectStack } from './detect-stack';

describe('MANIFEST_PATHS', () => {
  it('names every root file the detector knows how to read', () => {
    expect(MANIFEST_PATHS).toEqual([
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
    ]);
  });
});

describe('detectStack from package.json', () => {
  it('reads runtime and development dependencies alike', () => {
    const detected = detectStack({
      'package.json': [
        JSON.stringify({
          dependencies: { react: '^19.0.0' },
          devDependencies: { vite: '^7.0.0' },
        }),
      ],
    });

    expect(detected).toEqual(expect.arrayContaining(['react', 'vite']));
  });

  it('recognises frameworks published under a scope', () => {
    const detected = detectStack({
      'package.json': [
        JSON.stringify({
          dependencies: {
            '@nestjs/core': '^11.0.0',
            '@angular/core': '^19.0.0',
          },
        }),
      ],
    });

    expect(detected).toEqual(expect.arrayContaining(['nestjs', 'angular']));
  });

  it('calls a project typescript instead of javascript when typescript is present', () => {
    const detected = detectStack({
      'package.json': [
        JSON.stringify({
          devDependencies: { typescript: '^5.0.0' },
        }),
      ],
    });

    expect(detected).toContain('typescript');
    expect(detected).not.toContain('javascript');
  });

  it('survives a manifest that is not valid json', () => {
    expect(detectStack({ 'package.json': ['not json'] })).toEqual([]);
  });
});

describe('detectStack from composer.json', () => {
  it('recognises a php project', () => {
    const detected = detectStack({
      'composer.json': [JSON.stringify({ require: { php: '^8.2' } })],
    });

    expect(detected).toContain('php');
  });

  it('recognises laravel on top of php', () => {
    const detected = detectStack({
      'composer.json': [
        JSON.stringify({
          require: { 'laravel/framework': '^11.0' },
        }),
      ],
    });

    expect(detected).toEqual(expect.arrayContaining(['php', 'laravel']));
  });
});

describe('detectStack from java manifests', () => {
  it('recognises a maven project as java', () => {
    expect(detectStack({ 'pom.xml': ['<project></project>'] })).toContain(
      'java',
    );
  });

  it('recognises spring boot inside a maven build', () => {
    const detected = detectStack({
      'pom.xml': ['<artifactId>spring-boot-starter-web</artifactId>'],
    });

    expect(detected).toEqual(expect.arrayContaining(['java', 'springboot']));
  });

  it('recognises spring boot inside a gradle build', () => {
    const detected = detectStack({
      'build.gradle': ["id 'org.springframework.boot' version '3.2.0'"],
    });

    expect(detected).toEqual(expect.arrayContaining(['java', 'springboot']));
  });

  it('reads the kotlin flavour of a gradle build too', () => {
    expect(detectStack({ 'build.gradle.kts': ['plugins {}'] })).toContain(
      'java',
    );
  });
});

describe('detectStack from pubspec.yaml', () => {
  it('recognises a flutter project', () => {
    const detected = detectStack({
      'pubspec.yaml': ['dependencies:\n  flutter:\n    sdk: flutter\n'],
    });

    expect(detected).toContain('flutter');
  });

  it('does not call a plain dart package flutter', () => {
    expect(detectStack({ 'pubspec.yaml': ['name: cli_tool\n'] })).toEqual([]);
  });
});

describe('detectStack across manifests', () => {
  it('reports every stack a polyglot repository declares', () => {
    const detected = detectStack({
      'package.json': [JSON.stringify({ dependencies: { react: '^19.0.0' } })],
      'composer.json': [
        JSON.stringify({
          require: { 'laravel/framework': '^11.0' },
        }),
      ],
    });

    expect(detected).toEqual(
      expect.arrayContaining(['react', 'javascript', 'php', 'laravel']),
    );
  });

  it('never repeats a technology declared twice', () => {
    const detected = detectStack({
      'package.json': [
        JSON.stringify({
          dependencies: { react: '^19.0.0' },
          devDependencies: { react: '^19.0.0' },
        }),
      ],
    });

    expect(detected.filter((tech) => tech === 'react')).toHaveLength(1);
  });

  it('returns nothing when the repository declares no manifest', () => {
    expect(detectStack({})).toEqual([]);
  });
});

describe('detectStack recognises more javascript frameworks', () => {
  it('recognises next on top of react', () => {
    const detected = detectStack({
      'package.json': [JSON.stringify({ dependencies: { next: '^15.0.0' } })],
    });

    expect(detected).toContain('nextjs');
  });

  it('recognises astro', () => {
    const detected = detectStack({
      'package.json': [JSON.stringify({ dependencies: { astro: '^5.0.0' } })],
    });

    expect(detected).toContain('astro');
  });

  it('recognises vue', () => {
    const detected = detectStack({
      'package.json': [JSON.stringify({ dependencies: { vue: '^3.5.0' } })],
    });

    expect(detected).toContain('vue');
  });
});

describe('detectStack recognises database engines', () => {
  it('maps the mysql driver to mysql', () => {
    const detected = detectStack({
      'package.json': [JSON.stringify({ dependencies: { mysql2: '^3.0.0' } })],
    });

    expect(detected).toContain('mysql');
  });

  it('maps mongoose to mongodb', () => {
    const detected = detectStack({
      'package.json': [
        JSON.stringify({ dependencies: { mongoose: '^8.0.0' } }),
      ],
    });

    expect(detected).toContain('mongodb');
  });

  it('maps ioredis to redis', () => {
    const detected = detectStack({
      'package.json': [JSON.stringify({ dependencies: { ioredis: '^5.0.0' } })],
    });

    expect(detected).toContain('redis');
  });

  it('reads the engines a compose file declares, whatever the language', () => {
    const compose = [
      'services:',
      '  db:',
      '    image: postgres:16',
      '  cache:',
      '    image: redis:7',
    ].join('\n');

    const detected = detectStack({ 'docker-compose.yml': [compose] });

    expect(detected).toEqual(
      expect.arrayContaining(['docker', 'postgresql', 'redis']),
    );
  });

  it('recognises the postgres driver of a maven build', () => {
    const detected = detectStack({
      'pom.xml': ['<groupId>org.postgresql</groupId>'],
    });

    expect(detected).toEqual(expect.arrayContaining(['java', 'postgresql']));
  });
});

describe('detectStack recognises python and go', () => {
  it('recognises python from a requirements file', () => {
    expect(detectStack({ 'requirements.txt': ['requests==2.32.0'] })).toContain(
      'python',
    );
  });

  it('recognises django inside a requirements file', () => {
    const detected = detectStack({ 'requirements.txt': ['Django==5.0'] });

    expect(detected).toEqual(expect.arrayContaining(['python', 'django']));
  });

  it('recognises python from a pyproject file', () => {
    expect(detectStack({ 'pyproject.toml': ['[project]'] })).toContain(
      'python',
    );
  });

  it('recognises go from its module file', () => {
    expect(detectStack({ 'go.mod': ['module example.com/api'] })).toContain(
      'go',
    );
  });
});

describe('detectStack across a monorepo', () => {
  it('reads every workspace manifest, not just the root one', () => {
    const detected = detectStack({
      'package.json': [
        JSON.stringify({
          devDependencies: { turbo: '^2.0.0', typescript: '^5.4.0' },
        }),
        JSON.stringify({ dependencies: { '@nestjs/core': '^11.0.0' } }),
        JSON.stringify({ dependencies: { next: '^15.0.0', react: '^19.0.0' } }),
      ],
    });

    expect(detected).toEqual(
      expect.arrayContaining(['typescript', 'nestjs', 'nextjs', 'react']),
    );
  });

  it('calls the repository typescript when any workspace declares it', () => {
    const detected = detectStack({
      'package.json': [
        JSON.stringify({ dependencies: { express: '^5.0.0' } }),
        JSON.stringify({ devDependencies: { typescript: '^5.4.0' } }),
      ],
    });

    expect(detected).toContain('typescript');
    expect(detected).not.toContain('javascript');
  });

  it('mixes languages that live in different workspaces', () => {
    const detected = detectStack({
      'package.json': [JSON.stringify({ dependencies: { vue: '^3.5.0' } })],
      'pom.xml': ['<artifactId>spring-boot-starter-web</artifactId>'],
    });

    expect(detected).toEqual(
      expect.arrayContaining(['vue', 'java', 'springboot']),
    );
  });
});

describe('detectStack recognises the test tooling, which is what qably is for', () => {
  it('recognises playwright from its test package', () => {
    const detected = detectStack({
      'package.json': [
        JSON.stringify({ devDependencies: { '@playwright/test': '^1.50.0' } }),
      ],
    });

    expect(detected).toContain('playwright');
  });

  it('recognises playwright installed without the test runner package', () => {
    const detected = detectStack({
      'package.json': [
        JSON.stringify({ devDependencies: { playwright: '^1.50.0' } }),
      ],
    });

    expect(detected).toContain('playwright');
  });

  it('recognises jest', () => {
    const detected = detectStack({
      'package.json': [
        JSON.stringify({ devDependencies: { jest: '^30.0.0' } }),
      ],
    });

    expect(detected).toContain('jest');
  });

  it('recognises jest through its typescript preset', () => {
    const detected = detectStack({
      'package.json': [
        JSON.stringify({ devDependencies: { 'ts-jest': '^29.0.0' } }),
      ],
    });

    expect(detected).toContain('jest');
  });

  it('finds the test runner of a workspace, not only of the root', () => {
    const detected = detectStack({
      'package.json': [
        JSON.stringify({ devDependencies: { turbo: '^2.0.0' } }),
        JSON.stringify({ devDependencies: { jest: '^30.0.0' } }),
        JSON.stringify({ devDependencies: { '@playwright/test': '^1.50.0' } }),
      ],
    });

    expect(detected).toEqual(expect.arrayContaining(['jest', 'playwright']));
  });

  it('recognises fastapi in a python service', () => {
    const detected = detectStack({
      'requirements.txt': ['fastapi==0.115.0'],
    });

    expect(detected).toEqual(expect.arrayContaining(['python', 'fastapi']));
  });
});
