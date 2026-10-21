import {
  DECLARATION_SNAPSHOT_VERSION,
  buildDeclarationSnapshot,
  localDeclarationId,
  readDeclarationSnapshot,
  readDeclaredFile,
} from './index';

const FILE_PATH = 'src/cart.spec.ts';

function declared(content: string) {
  const result = readDeclaredFile({
    filePath: FILE_PATH,
    content,
    truncated: false,
  });
  if (result.kind !== 'declared') {
    throw new Error(`expected declarations, got ${result.reason}`);
  }
  return result.file;
}

describe('readDeclaredFile', () => {
  it('gives every declaration an id made of its describe path, its title and its occurrence', () => {
    const file = declared(
      [
        "describe('Cart', () => {",
        "  it('adds an item', () => { expect(1).toBe(1); });",
        "  it('adds an item', () => { expect(2).toBe(2); });",
        '});',
        "it('adds an item', () => {});",
      ].join('\n'),
    );

    expect(file.declarations.map((declaration) => declaration.id)).toEqual([
      localDeclarationId(['Cart'], 'adds an item', 0),
      localDeclarationId(['Cart'], 'adds an item', 1),
      localDeclarationId([], 'adds an item', 0),
    ]);
  });

  it('keeps the id of a test that only moved, and changes neither of its hashes', () => {
    const before = declared(
      "describe('Cart', () => {\n  it('adds', () => { expect(1).toBe(1); });\n});",
    );
    const after = declared(
      "\n\n\ndescribe('Cart', () => {\n\n  it('adds', () => { expect(1).toBe(1); });\n});",
    );

    const [moved] = after.declarations;
    const [original] = before.declarations;
    expect(moved.id).toBe(original.id);
    expect(moved.bodyHash).toBe(original.bodyHash);
    expect(moved.contextHash).toBe(original.contextHash);
    expect(moved.startLine).not.toBe(original.startLine);
  });

  it('uses the raw source text of a title computed at runtime', () => {
    const file = declared(
      'const n = 2;\nit(`adds ${n} items`, () => { expect(n).toBe(2); });',
    );

    expect(file.declarations[0].id).toBe(
      localDeclarationId([], '`adds ${n} items`', 0),
    );
  });

  it.each([
    ['a truncated source', 'it("a", () => {});', true, 'truncated'],
    ['a syntax error', 'it("a", () => {', false, 'syntax-error'],
    [
      'a file with no declaration the parser sees',
      'const x = 1;',
      false,
      'no-declarations',
    ],
  ])('does not read %s', (_label, content, truncated, reason) => {
    expect(
      readDeclaredFile({ filePath: FILE_PATH, content, truncated }),
    ).toEqual({ kind: 'undeclared', reason });
  });

  it('does not read a language the parser does not support', () => {
    expect(
      readDeclaredFile({
        filePath: 'tests/test_cart.py',
        content: 'def test_adds(): pass',
        truncated: false,
      }),
    ).toEqual({ kind: 'undeclared', reason: 'unsupported-extension' });
  });
});

describe('declaration snapshots', () => {
  const file = () =>
    declared("describe('Cart', () => {\n  it('adds', () => {});\n});");

  it('round-trips through the JSON a database column stores', () => {
    const snapshot = buildDeclarationSnapshot(file(), [
      {
        id: localDeclarationId(['Cart'], 'removes', 0),
        title: 'removes',
        describePath: ['Cart'],
      },
    ]);

    const stored: unknown = JSON.parse(JSON.stringify(snapshot));

    expect(readDeclarationSnapshot(stored)).toEqual(snapshot);
    expect(snapshot.version).toBe(DECLARATION_SNAPSHOT_VERSION);
  });

  it('keeps an unknown removed list apart from an empty one', () => {
    expect(buildDeclarationSnapshot(file(), null).removed).toBeNull();
    expect(buildDeclarationSnapshot(file(), []).removed).toEqual([]);
  });

  it.each([
    ['nothing', null],
    [
      'a value of another version',
      { ...buildDeclarationSnapshot(file(), null), version: 99 },
    ],
    [
      'a value without declarations',
      { version: DECLARATION_SNAPSHOT_VERSION, fileContextHash: 'x' },
    ],
    ['a string', 'snapshot'],
  ])('reads %s as no snapshot', (_label, value) => {
    expect(readDeclarationSnapshot(value)).toBeNull();
  });
});
