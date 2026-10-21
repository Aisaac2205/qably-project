describe('loading the TypeScript compiler', () => {
  afterEach(() => {
    jest.dontMock('typescript');
  });

  it('loads it on the first parse, once, and not when the module is imported', () => {
    const load = jest.fn();
    jest.doMock('typescript', () => {
      load();
      return jest.requireActual<object>('typescript');
    });

    jest.isolateModules(() => {
      const { parseTestDeclarations } =
        jest.requireActual<typeof import('./index')>('./index');
      expect(load).not.toHaveBeenCalled();

      const input = {
        filePath: 'src/cart.test.ts',
        content: "it('adds', () => {});",
      };
      expect(parseTestDeclarations(input).kind).toBe('parsed');
      expect(parseTestDeclarations(input).kind).toBe('parsed');
      expect(load).toHaveBeenCalledTimes(1);
    });
  });
});
