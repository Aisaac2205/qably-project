import { diffDeclarations, readDeclaredFile, type DeclaredFile } from './index';

function declared(content: string): DeclaredFile {
  const result = readDeclaredFile({
    filePath: 'src/cart.spec.ts',
    content,
    truncated: false,
  });
  if (result.kind !== 'declared') throw new Error(result.reason);
  return result.file;
}

function source(
  options: {
    helper?: string;
    hookA?: string;
    bodies?: Record<string, string>;
    titlesB?: string[];
  } = {},
): string {
  const body = (title: string) =>
    options.bodies?.[title] ?? `expect('${title}').toBeTruthy();`;
  const titlesB = options.titlesB ?? ['b1', 'b2'];

  return [
    `const helper = () => ${options.helper ?? '1'};`,
    "describe('A', () => {",
    `  beforeEach(() => { ${options.hookA ?? 'setup()'}; });`,
    ...['a1', 'a2'].map(
      (title) => `  it('${title}', () => { ${body(title)} });`,
    ),
    '});',
    "describe('B', () => {",
    ...titlesB.map((title) => `  it('${title}', () => { ${body(title)} });`),
    '});',
  ].join('\n');
}

const titles = (file: { changed: readonly { title: string }[] }) =>
  file.changed.map(({ title }) => title);

describe('diffDeclarations', () => {
  it('counts every declaration as changed, and nothing as removed, without a baseline', () => {
    const diff = diffDeclarations(declared(source()), null);

    expect(titles(diff)).toEqual(['a1', 'a2', 'b1', 'b2']);
    expect(diff.removed).toBeNull();
    expect(diff.wholeFile).toBe('no-baseline');
  });

  it('finds nothing when only the lines moved', () => {
    const before = declared(source());
    const after = declared(`\n\n${source()}`);

    const diff = diffDeclarations(after, before);

    expect(diff.changed).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.wholeFile).toBeNull();
  });

  it('finds the one test whose body changed', () => {
    const diff = diffDeclarations(
      declared(source({ bodies: { b1: 'expect(2).toBe(2);' } })),
      declared(source()),
    );

    expect(titles(diff)).toEqual(['b1']);
  });

  it('finds every test of a describe whose hook changed, and only those', () => {
    const diff = diffDeclarations(
      declared(source({ hookA: 'setup(true)' })),
      declared(source()),
    );

    expect(titles(diff)).toEqual(['a1', 'a2']);
  });

  it('finds every test when the file context changed', () => {
    const diff = diffDeclarations(
      declared(source({ helper: '2' })),
      declared(source()),
    );

    expect(titles(diff)).toEqual(['a1', 'a2', 'b1', 'b2']);
    expect(diff.wholeFile).toBe('file-context');
    expect(diff.removed).toEqual([]);
  });

  it('finds a new test and records a removed one without describing it', () => {
    const diff = diffDeclarations(
      declared(source({ titlesB: ['b1', 'b3'] })),
      declared(source()),
    );

    expect(titles(diff)).toEqual(['b3']);
    expect(diff.removed).toEqual([
      {
        id: JSON.stringify([['B'], 'b2', 0]),
        title: 'b2',
        describePath: ['B'],
      },
    ]);
  });

  it('does not report a removal while a test with the same name remains', () => {
    const twice = [
      "describe('B', () => {",
      "  it('b1', () => { expect(1).toBe(1); });",
      "  it('b1', () => { expect(2).toBe(2); });",
      '});',
    ].join('\n');
    const once = [
      "describe('B', () => {",
      "  it('b1', () => { expect(2).toBe(2); });",
      '});',
    ].join('\n');

    const diff = diffDeclarations(declared(once), declared(twice));

    expect(diff.removed).toEqual([]);
    expect(titles(diff)).toEqual(['b1']);
  });

  it('reports a name once when every copy of it is gone', () => {
    const twice = [
      "describe('B', () => {",
      "  it('b1', () => { expect(1).toBe(1); });",
      "  it('b1', () => { expect(2).toBe(2); });",
      "  it('b2', () => { expect(3).toBe(3); });",
      '});',
    ].join('\n');
    const none = [
      "describe('B', () => {",
      "  it('b2', () => { expect(3).toBe(3); });",
      '});',
    ].join('\n');

    const diff = diffDeclarations(declared(none), declared(twice));

    expect(diff.removed).toEqual([
      {
        id: JSON.stringify([['B'], 'b1', 0]),
        title: 'b1',
        describePath: ['B'],
      },
    ]);
  });

  it('sends again what an incomplete baseline left undescribed', () => {
    const before = declared(source());
    const [, a2] = before.declarations;

    const diff = diffDeclarations(declared(source()), {
      ...before,
      undescribed: [a2.id],
    });

    expect(titles(diff)).toEqual(['a2']);
  });

  it('never counts a todo declaration as changed', () => {
    const withTodo = [
      "describe('B', () => {",
      "  it('b1', () => { expect(1).toBe(1); });",
      "  it.todo('later');",
      '});',
    ].join('\n');

    expect(titles(diffDeclarations(declared(withTodo), null))).toEqual(['b1']);
  });

  it('records removals even when the file context changed', () => {
    const diff = diffDeclarations(
      declared(source({ helper: '2', titlesB: ['b1'] })),
      declared(source()),
    );

    expect(diff.removed?.map(({ title }) => title)).toEqual(['b2']);
  });
});
