import { detectStack } from './detect-stack';

describe('detectStack', () => {
  it('reads runtime and development dependencies alike', () => {
    const detected = detectStack({
      dependencies: { react: '^19.0.0' },
      devDependencies: { vite: '^7.0.0' },
    });

    expect(detected).toEqual(expect.arrayContaining(['react', 'vite']));
  });

  it('recognises frameworks published under a scope', () => {
    const detected = detectStack({
      dependencies: { '@nestjs/core': '^11.0.0', '@angular/core': '^19.0.0' },
    });

    expect(detected).toEqual(expect.arrayContaining(['nestjs', 'angular']));
  });

  it('calls a project javascript when it declares no typescript', () => {
    expect(detectStack({ dependencies: { express: '^5.0.0' } })).toContain(
      'javascript',
    );
  });

  it('calls a project typescript instead of javascript when typescript is present', () => {
    const detected = detectStack({ devDependencies: { typescript: '^5.0.0' } });

    expect(detected).toContain('typescript');
    expect(detected).not.toContain('javascript');
  });

  it('maps the postgres driver to the database it talks to', () => {
    expect(detectStack({ dependencies: { pg: '^8.0.0' } })).toContain(
      'postgresql',
    );
  });

  it('ignores dependencies it has no icon for', () => {
    expect(detectStack({ dependencies: { lodash: '^4.0.0' } })).toEqual([
      'javascript',
    ]);
  });

  it('never repeats a technology declared twice', () => {
    const detected = detectStack({
      dependencies: { react: '^19.0.0' },
      devDependencies: { react: '^19.0.0' },
    });

    expect(detected.filter((tech) => tech === 'react')).toHaveLength(1);
  });

  it('returns nothing when the file is not a usable package manifest', () => {
    expect(detectStack(null)).toEqual([]);
    expect(detectStack('not json')).toEqual([]);
    expect(detectStack({})).toEqual([]);
  });
});
