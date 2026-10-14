import {
  findCaseIdentityCollisions,
  findLegacyKeyCollisions,
  findLegacyTruncatedClaims,
  resolveCaseIdentityKey,
} from './case-identity';

// The real it.each titles of suite-list-query.service.spec.ts: jest-junit
// reports "<describe chain> <title>" as both the name and the classname, and the
// rows only differ after character 120.
const ROWS_PREFIX =
  'SuiteListQueryService.page bounded reads reads the suites once, the case counts once and the run windows once for sort ';

function eachRow(sort: string, status: string, suites: number) {
  const name = `${ROWS_PREFIX}${sort} and status ${status} with ${suites} suites`;
  return { name, className: name };
}

describe('resolveCaseIdentityKey', () => {
  it('uses the raw name alone when no classname is reported', () => {
    expect(resolveCaseIdentityKey({ name: 'Adds to cart' })).toBe(
      'Adds to cart',
    );
  });

  it('uses the raw name alone when classname is an empty string', () => {
    expect(
      resolveCaseIdentityKey({ name: 'Adds to cart', className: '' }),
    ).toBe('Adds to cart');
  });

  it('uses the raw name alone when classname is already the full name, as jest-junit reports it', () => {
    expect(
      resolveCaseIdentityKey({
        name: 'Checkout adds an item',
        className: 'Checkout adds an item',
      }),
    ).toBe('Checkout adds an item');
  });

  it('uses the raw name alone when classname is a strict prefix of the name', () => {
    expect(
      resolveCaseIdentityKey({
        name: 'Checkout adds an item',
        className: 'Checkout',
      }),
    ).toBe('Checkout adds an item');
  });

  it('uses the raw name alone when classname equals the name but each was truncated to a different length, as a long jest-junit title reports it', () => {
    const shared =
      'CORS headers on a body-parser rejection (e2e) carries access-control-allow-origin on the 400 the JSON body parser produces';
    const truncatedName = shared.slice(0, 120);

    expect(
      resolveCaseIdentityKey({ name: truncatedName, className: shared }),
    ).toBe(truncatedName);
  });

  it('builds a composite key when classname is present and not a prefix of the name, as pytest and surefire report it', () => {
    expect(
      resolveCaseIdentityKey({
        name: 'test_add_item_updates_total',
        className: 'tests.checkout.test_checkout',
      }),
    ).toBe('tests.checkout.test_checkout::test_add_item_updates_total');
  });
});

describe('findCaseIdentityCollisions', () => {
  it('reports nothing when every case has a distinct identity', () => {
    const collisions = findCaseIdentityCollisions([
      { name: 'Adds to cart' },
      { name: 'Removes from cart' },
    ]);

    expect(collisions).toEqual([]);
  });

  it('reports nothing when the same (name, classname) pair repeats, since that is a replay, not a collision', () => {
    const collisions = findCaseIdentityCollisions([
      { name: 'Adds to cart', className: 'Checkout' },
      { name: 'Adds to cart', className: 'Checkout' },
    ]);

    expect(collisions).toEqual([]);
  });

  it('flags two genuinely different cases that resolve to the same composite identity', () => {
    const collisions = findCaseIdentityCollisions([
      {
        name: 'tests.checkout.test_checkout::test_add_item',
        className: undefined,
      },
      { name: 'test_add_item', className: 'tests.checkout.test_checkout' },
    ]);

    expect(collisions).toEqual([
      {
        key: 'tests.checkout.test_checkout::test_add_item',
        count: 2,
        claimants: [
          'tests.checkout.test_checkout::test_add_item',
          'tests.checkout.test_checkout › test_add_item',
        ],
      },
    ]);
  });

  it('never collides two cases whose classnames differ, even when their names match', () => {
    const collisions = findCaseIdentityCollisions([
      { name: 'Adds to cart', className: 'Checkout' },
      { name: 'Adds to cart', className: 'Cart' },
    ]);

    expect(collisions).toEqual([]);
  });

  it('flags three-way collisions with the full distinct count, not just two', () => {
    const collisions = findCaseIdentityCollisions([
      { name: 'Adds to cart' },
      { name: 'Adds to cart', className: 'Adds' },
      { name: 'Adds to cart', className: 'Adds to' },
    ]);

    expect(collisions).toEqual([
      {
        key: 'Adds to cart',
        count: 3,
        claimants: [
          'Adds to cart',
          'Adds › Adds to cart',
          'Adds to › Adds to cart',
        ],
      },
    ]);
  });

  it('keeps parametrized rows that differ only after character 120 apart', () => {
    const rows = [
      eachRow('createdAt', 'all', 1),
      eachRow('cases', 'all', 1),
      eachRow('createdAt', 'active', 100),
    ];

    expect(rows[0].name.slice(0, 120)).toBe(rows[1].name.slice(0, 120));
    expect(findCaseIdentityCollisions(rows)).toEqual([]);
    expect(new Set(rows.map(resolveCaseIdentityKey)).size).toBe(3);
  });

  it('lists at most ten claimants but counts every one', () => {
    const cases = Array.from({ length: 14 }, (_, index) => ({
      name: 'Adds to cart',
      className: `Adds to cart ${'x'.repeat(index)}`,
    }));

    const [collision] = findCaseIdentityCollisions(cases);

    expect(collision.count).toBe(14);
    expect(collision.claimants).toHaveLength(10);
  });
});

describe('findLegacyKeyCollisions', () => {
  it('reports nothing when every case has a distinct bare name', () => {
    const collisions = findLegacyKeyCollisions([
      { name: 'test_add_item', className: 'tests.checkout.a' },
      { name: 'test_add_item_two', className: 'tests.checkout.b' },
    ]);

    expect(collisions).toEqual([]);
  });

  it('reports nothing when two cases share a name but resolve to the same identity key, since that is a replay', () => {
    const collisions = findLegacyKeyCollisions([
      { name: 'Adds to cart', className: 'Checkout' },
      { name: 'Adds to cart', className: 'Checkout' },
    ]);

    expect(collisions).toEqual([]);
  });

  it('flags two composites that share a bare name but come from different classnames', () => {
    const collisions = findLegacyKeyCollisions([
      { name: 'test_add_item', className: 'tests.checkout.a' },
      { name: 'test_add_item', className: 'tests.checkout.b' },
    ]);

    expect(collisions).toEqual([
      {
        key: 'test_add_item',
        count: 2,
        claimants: [
          'tests.checkout.a::test_add_item',
          'tests.checkout.b::test_add_item',
        ],
      },
    ]);
  });

  it('flags a plain case and a composite case that share the plain case bare name', () => {
    const collisions = findLegacyKeyCollisions([
      { name: 'test_add_item' },
      { name: 'test_add_item', className: 'tests.checkout.a' },
    ]);

    expect(collisions).toEqual([
      {
        key: 'test_add_item',
        count: 2,
        claimants: ['test_add_item', 'tests.checkout.a::test_add_item'],
      },
    ]);
  });

  it('excludes an identity that is already a case identity collision from counting as a legacy claimant', () => {
    const collisions = findLegacyKeyCollisions([
      { name: 'test_add_item', className: 'tests.checkout' },
      { name: 'tests.checkout::test_add_item' },
      { name: 'test_add_item', className: 'tests.other' },
    ]);

    expect(collisions).toEqual([]);
  });
});

describe('findLegacyTruncatedClaims', () => {
  it('maps a long identity to the key the 120-character cut used to give it', () => {
    const row = eachRow('createdAt', 'all', 1);

    const claims = findLegacyTruncatedClaims([row]);

    expect(claims.get(row.name)).toBe(row.name.slice(0, 120));
  });

  it('claims nothing for a name that was never cut', () => {
    expect(findLegacyTruncatedClaims([{ name: 'Adds to cart' }]).size).toBe(0);
  });

  it('claims nothing when several identities share the old truncated key', () => {
    const claims = findLegacyTruncatedClaims([
      eachRow('createdAt', 'all', 1),
      eachRow('cases', 'all', 1),
    ]);

    expect(claims.size).toBe(0);
  });

  it('claims nothing when another identity is exactly the old truncated key', () => {
    const row = eachRow('createdAt', 'all', 1);
    const exact = { name: row.name.slice(0, 120) };

    expect(findLegacyTruncatedClaims([row, exact]).size).toBe(0);
  });

  it('builds the old key of a composite identity from the cut name', () => {
    const name = `test_${'a'.repeat(200)}`;

    const claims = findLegacyTruncatedClaims([
      { name, className: 'tests.checkout' },
    ]);

    expect(claims.get(`tests.checkout::${name}`)).toBe(
      `tests.checkout::${name.slice(0, 120)}`,
    );
  });
});
