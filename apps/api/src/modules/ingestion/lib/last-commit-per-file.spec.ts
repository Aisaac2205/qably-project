import { lastCommitPerFile } from './last-commit-per-file';

function commit(sha: string, position: number, attributedFiles: string[]) {
  return { sha, position, attributedFiles };
}

describe('lastCommitPerFile', () => {
  it('maps every path to the commit that touched it', () => {
    const result = lastCommitPerFile([
      commit('sha-1', 0, ['a.spec.ts']),
      commit('sha-2', 1, ['b.spec.ts', 'c.spec.ts']),
    ]);

    expect([...result]).toEqual([
      ['a.spec.ts', 'sha-1'],
      ['b.spec.ts', 'sha-2'],
      ['c.spec.ts', 'sha-2'],
    ]);
  });

  it('lets a later commit override an earlier one for the same path', () => {
    const result = lastCommitPerFile([
      commit('sha-1', 0, ['a.spec.ts', 'x.spec.ts']),
      commit('sha-2', 1, ['a.spec.ts']),
      commit('sha-3', 2, ['a.spec.ts', 'y.spec.ts']),
    ]);

    expect(result.get('a.spec.ts')).toBe('sha-3');
    expect(result.get('x.spec.ts')).toBe('sha-1');
    expect(result.get('y.spec.ts')).toBe('sha-3');
  });

  it('orders by position, not by the order of the input array', () => {
    const result = lastCommitPerFile([
      commit('sha-3', 2, ['a.spec.ts']),
      commit('sha-1', 0, ['a.spec.ts']),
      commit('sha-2', 1, ['a.spec.ts']),
    ]);

    expect(result.get('a.spec.ts')).toBe('sha-3');
  });

  it('lets the entry listed last win when two commits share a position', () => {
    const result = lastCommitPerFile([
      commit('sha-first', 1, ['a.spec.ts']),
      commit('sha-second', 1, ['a.spec.ts']),
    ]);

    expect(result.get('a.spec.ts')).toBe('sha-second');
  });

  it('answers an empty map for no commits', () => {
    expect(lastCommitPerFile([]).size).toBe(0);
  });

  it('answers an empty map when no commit has attributed files, as for events stored before the attributedFiles column', () => {
    const result = lastCommitPerFile([
      commit('sha-1', 0, []),
      commit('sha-2', 1, []),
    ]);

    expect(result.size).toBe(0);
  });

  it('copes with a path repeated inside one commit and a sha repeated across commits', () => {
    const result = lastCommitPerFile([
      commit('sha-1', 0, ['a.spec.ts', 'a.spec.ts']),
      commit('sha-1', 1, ['a.spec.ts']),
      commit('sha-2', 2, ['b.spec.ts', 'b.spec.ts']),
    ]);

    expect([...result]).toEqual([
      ['a.spec.ts', 'sha-1'],
      ['b.spec.ts', 'sha-2'],
    ]);
  });

  it('treats paths as exact strings', () => {
    const result = lastCommitPerFile([
      commit('sha-1', 0, ['src/A.spec.ts', 'src/a.spec.ts']),
    ]);

    expect(result.size).toBe(2);
  });

  it('never mutates its input', () => {
    const input = [
      commit('sha-2', 1, ['a.spec.ts']),
      commit('sha-1', 0, ['a.spec.ts', 'b.spec.ts']),
    ];
    const snapshot = structuredClone(input);
    Object.freeze(input);
    input.forEach((entry) => Object.freeze(entry.attributedFiles));

    lastCommitPerFile(input);

    expect(input).toEqual(snapshot);
  });
});
