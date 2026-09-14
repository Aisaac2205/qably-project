import { splitRepo } from './split-repo';

describe('splitRepo', () => {
  it('splits an owner/repo string on the first slash', () => {
    expect(splitRepo('acme/shop')).toEqual({ owner: 'acme', repo: 'shop' });
  });

  it('treats a slash-free string as both owner and repo', () => {
    expect(splitRepo('shop')).toEqual({ owner: 'shop', repo: 'shop' });
  });
});
