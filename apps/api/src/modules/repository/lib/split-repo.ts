export function splitRepo(full: string): { owner: string; repo: string } {
  const index = full.indexOf('/');

  return index === -1
    ? { owner: full, repo: full }
    : { owner: full.slice(0, index), repo: full.slice(index + 1) };
}
