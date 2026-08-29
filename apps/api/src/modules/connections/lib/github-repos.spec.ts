import { toAvailableRepos } from './github-repos';

const repo = {
  id: 42,
  full_name: 'acme/shop',
  private: true,
  default_branch: 'main',
};

describe('toAvailableRepos', () => {
  it('keeps the owner/name form the connection contract expects', () => {
    expect(toAvailableRepos([repo])).toEqual([
      {
        id: '42',
        fullName: 'acme/shop',
        isPrivate: true,
        defaultBranch: 'main',
      },
    ]);
  });

  it('falls back to main when github omits the default branch', () => {
    const withoutBranch = { id: repo.id, full_name: repo.full_name };

    expect(toAvailableRepos([withoutBranch])[0].defaultBranch).toBe('main');
  });

  it('drops entries that carry no usable full name', () => {
    expect(toAvailableRepos([{ id: 1 }, repo])).toHaveLength(1);
  });

  it('returns nothing when github answers with something that is not a list', () => {
    expect(toAvailableRepos(null)).toEqual([]);
    expect(toAvailableRepos({ message: 'Bad credentials' })).toEqual([]);
  });

  it('sorts repositories by name so the picker is predictable', () => {
    const zulu = { ...repo, id: 2, full_name: 'acme/zulu' };
    const alpha = { ...repo, id: 3, full_name: 'acme/alpha' };

    expect(toAvailableRepos([zulu, alpha]).map((r) => r.fullName)).toEqual([
      'acme/alpha',
      'acme/zulu',
    ]);
  });
});
