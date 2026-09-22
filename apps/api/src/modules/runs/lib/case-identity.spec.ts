import {
  findCaseIdentityCollisions,
  resolveCaseIdentityKey,
} from './case-identity';

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

    expect(collisions).toEqual([{ key: 'Adds to cart', count: 3 }]);
  });
});
