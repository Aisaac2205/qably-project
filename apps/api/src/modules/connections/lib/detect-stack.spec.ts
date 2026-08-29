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
    ]);
  });
});

describe('detectStack from package.json', () => {
  it('reads runtime and development dependencies alike', () => {
    const detected = detectStack({
      'package.json': JSON.stringify({
        dependencies: { react: '^19.0.0' },
        devDependencies: { vite: '^7.0.0' },
      }),
    });

    expect(detected).toEqual(expect.arrayContaining(['react', 'vite']));
  });

  it('recognises frameworks published under a scope', () => {
    const detected = detectStack({
      'package.json': JSON.stringify({
        dependencies: { '@nestjs/core': '^11.0.0', '@angular/core': '^19.0.0' },
      }),
    });

    expect(detected).toEqual(expect.arrayContaining(['nestjs', 'angular']));
  });

  it('calls a project typescript instead of javascript when typescript is present', () => {
    const detected = detectStack({
      'package.json': JSON.stringify({
        devDependencies: { typescript: '^5.0.0' },
      }),
    });

    expect(detected).toContain('typescript');
    expect(detected).not.toContain('javascript');
  });

  it('survives a manifest that is not valid json', () => {
    expect(detectStack({ 'package.json': 'not json' })).toEqual([]);
  });
});

describe('detectStack from composer.json', () => {
  it('recognises a php project', () => {
    const detected = detectStack({
      'composer.json': JSON.stringify({ require: { php: '^8.2' } }),
    });

    expect(detected).toContain('php');
  });

  it('recognises laravel on top of php', () => {
    const detected = detectStack({
      'composer.json': JSON.stringify({
        require: { 'laravel/framework': '^11.0' },
      }),
    });

    expect(detected).toEqual(expect.arrayContaining(['php', 'laravel']));
  });
});

describe('detectStack from java manifests', () => {
  it('recognises a maven project as java', () => {
    expect(detectStack({ 'pom.xml': '<project></project>' })).toContain('java');
  });

  it('recognises spring boot inside a maven build', () => {
    const detected = detectStack({
      'pom.xml': '<artifactId>spring-boot-starter-web</artifactId>',
    });

    expect(detected).toEqual(expect.arrayContaining(['java', 'springboot']));
  });

  it('recognises spring boot inside a gradle build', () => {
    const detected = detectStack({
      'build.gradle': "id 'org.springframework.boot' version '3.2.0'",
    });

    expect(detected).toEqual(expect.arrayContaining(['java', 'springboot']));
  });

  it('reads the kotlin flavour of a gradle build too', () => {
    expect(detectStack({ 'build.gradle.kts': 'plugins {}' })).toContain('java');
  });
});

describe('detectStack from pubspec.yaml', () => {
  it('recognises a flutter project', () => {
    const detected = detectStack({
      'pubspec.yaml': 'dependencies:\n  flutter:\n    sdk: flutter\n',
    });

    expect(detected).toContain('flutter');
  });

  it('does not call a plain dart package flutter', () => {
    expect(detectStack({ 'pubspec.yaml': 'name: cli_tool\n' })).toEqual([]);
  });
});

describe('detectStack across manifests', () => {
  it('reports every stack a polyglot repository declares', () => {
    const detected = detectStack({
      'package.json': JSON.stringify({ dependencies: { react: '^19.0.0' } }),
      'composer.json': JSON.stringify({
        require: { 'laravel/framework': '^11.0' },
      }),
    });

    expect(detected).toEqual(
      expect.arrayContaining(['react', 'javascript', 'php', 'laravel']),
    );
  });

  it('never repeats a technology declared twice', () => {
    const detected = detectStack({
      'package.json': JSON.stringify({
        dependencies: { react: '^19.0.0' },
        devDependencies: { react: '^19.0.0' },
      }),
    });

    expect(detected.filter((tech) => tech === 'react')).toHaveLength(1);
  });

  it('returns nothing when the repository declares no manifest', () => {
    expect(detectStack({})).toEqual([]);
  });
});
