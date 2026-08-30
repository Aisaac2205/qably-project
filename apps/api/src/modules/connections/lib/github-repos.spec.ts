import { toAvailableRepos } from './github-repos';

const repo = {
  id: 42,
  full_name: 'acme/shop',
  private: true,
  default_branch: 'main',
  pushed_at: '2026-06-01T00:00:00Z',
};

describe('toAvailableRepos', () => {
  it('keeps the owner/name form the connection contract expects', () => {
    expect(toAvailableRepos([repo])).toEqual([
      {
        id: '42',
        fullName: 'acme/shop',
        isPrivate: true,
        defaultBranch: 'main',
        updatedAt: '2026-06-01T00:00:00Z',
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

  it('puts the most recently pushed repository first, like the picker expects', () => {
    const stale = {
      ...repo,
      id: 2,
      full_name: 'acme/alpha',
      pushed_at: '2026-01-01T00:00:00Z',
    };
    const fresh = {
      ...repo,
      id: 3,
      full_name: 'acme/zulu',
      pushed_at: '2026-08-01T00:00:00Z',
    };

    expect(toAvailableRepos([stale, fresh]).map((r) => r.fullName)).toEqual([
      'acme/zulu',
      'acme/alpha',
    ]);
  });

  it('falls back to the update timestamp when github reports no push', () => {
    const withoutPush = {
      id: 9,
      full_name: 'acme/docs',
      updated_at: '2026-05-05T00:00:00Z',
    };

    expect(toAvailableRepos([withoutPush])[0].updatedAt).toBe(
      '2026-05-05T00:00:00Z',
    );
  });

  it('sinks a repository with no timestamp to the bottom instead of dropping it', () => {
    const undated = { id: 9, full_name: 'acme/docs' };

    expect(toAvailableRepos([repo, undated]).map((r) => r.fullName)).toEqual([
      'acme/shop',
      'acme/docs',
    ]);
  });
});
