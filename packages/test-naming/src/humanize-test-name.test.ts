import { describe, expect, it } from 'vitest';

import { humanizeTestName } from './humanize-test-name';
import type { Convention } from './conventions';

const BELL = String.fromCharCode(7);
const COMBINING_ACUTE = String.fromCharCode(769);

describe('humanizeTestName', () => {
  describe('vitest junit reporter', () => {
    it('splits the describe chain on " > " and keeps the leaf as title', () => {
      const result = humanizeTestName({
        name: 'useCreateRun > keeps the same start callback across a re-render with no state change',
        className: 'src/features/runs/test/use-create-run.test.tsx',
      });

      expect(result.convention).toBe<Convention>('vitest');
      expect(result.path).toEqual(['useCreateRun']);
      expect(result.title).toBe('Keeps the same start callback across a re-render with no state change');
      expect(result.parameter).toBeUndefined();
    });

    it('keeps every nested describe as a path segment', () => {
      const result = humanizeTestName({
        name: 'RunDetail > keyboard shortcuts > marks the active case as passed with P',
      });

      expect(result.path).toEqual(['RunDetail', 'keyboard shortcuts']);
      expect(result.title).toBe('Marks the active case as passed with P');
    });

    it('treats a file-like classname without separator as a leaf-only vitest case', () => {
      const result = humanizeTestName({
        name: 'renders the empty state',
        className: 'src/features/projects/suites/test/suite-list.test.tsx',
      });

      expect(result.convention).toBe<Convention>('vitest');
      expect(result.path).toEqual([]);
      expect(result.title).toBe('Renders the empty state');
    });
  });

  describe('playwright junit reporter', () => {
    it('splits on " › " and drops the spec file from the path', () => {
      const result = humanizeTestName({
        name: 'checkout.spec.ts › Checkout › rejects an empty cart',
        className: 'checkout.spec.ts',
      });

      expect(result.convention).toBe<Convention>('playwright');
      expect(result.path).toEqual(['Checkout']);
      expect(result.title).toBe('Rejects an empty cart');
    });
  });

  describe('pytest junit reporter', () => {
    it('reads the dotted classname, strips test prefixes and extracts the parameter', () => {
      const result = humanizeTestName({
        name: 'test_reject_empty_cart[empty]',
        className: 'tests.test_cart.TestCart',
        filePath: 'tests/test_cart.py',
      });

      expect(result.convention).toBe<Convention>('pytest');
      expect(result.path).toEqual(['TestCart']);
      expect(result.title).toBe('Reject empty cart');
      expect(result.parameter).toBe('empty');
    });

    it('accepts pytest node ids with "::" separators', () => {
      const result = humanizeTestName({
        name: 'tests/test_cart.py::TestCart::test_reject_empty_cart',
      });

      expect(result.convention).toBe<Convention>('pytest');
      expect(result.path).toEqual(['TestCart']);
      expect(result.title).toBe('Reject empty cart');
    });
  });

  describe('java junit reporters', () => {
    it('uses the simple class name as path and splits the camelCase method', () => {
      const result = humanizeTestName({
        name: 'shouldRejectEmptyCart',
        className: 'com.acme.checkout.CartServiceTest',
      });

      expect(result.convention).toBe<Convention>('junit-java');
      expect(result.path).toEqual(['CartServiceTest']);
      expect(result.title).toBe('Should reject empty cart');
    });

    it('keeps a package with an underscore as java, not pytest', () => {
      const result = humanizeTestName({
        name: 'shouldRejectEmptyCart',
        className: 'com.acme.my_service.PaymentServiceTest',
      });

      expect(result.convention).toBe<Convention>('junit-java');
      expect(result.path).toEqual(['PaymentServiceTest']);
      expect(result.title).toBe('Should reject empty cart');
    });

    it('keeps an underscored java method in an underscored package as java', () => {
      const result = humanizeTestName({
        name: 'shouldReturn_whenInvalid',
        className: 'com.acme.order_service.OrderServiceTest',
      });

      expect(result.convention).toBe<Convention>('junit-java');
      expect(result.path).toEqual(['OrderServiceTest']);
      expect(result.title).toBe('Should return when invalid');
    });

    it('keeps a test_-prefixed camelCase java method as java', () => {
      const result = humanizeTestName({
        name: 'test_calculateTotal',
        className: 'com.acme.order_service.OrderServiceTest',
      });

      expect(result.convention).toBe<Convention>('junit-java');
      expect(result.title).toBe('Calculate total');
    });

    it('extracts the argument list of a JUnit 5 parameterized method as the parameter', () => {
      const result = humanizeTestName({
        name: 'shouldValidate(String, int)',
        className: 'com.acme.api.ValidatorTest',
      });

      expect(result.convention).toBe<Convention>('junit-java');
      expect(result.path).toEqual(['ValidatorTest']);
      expect(result.title).toBe('Should validate');
      expect(result.parameter).toBe('String, int');
    });

    it('extracts the invocation index of a JUnit 5 display name as the parameter', () => {
      const result = humanizeTestName({
        name: '[1] apple, 1',
        className: 'com.acme.api.FruitTest',
      });

      expect(result.convention).toBe<Convention>('junit-java');
      expect(result.path).toEqual(['FruitTest']);
      expect(result.title).toBe('Apple, 1');
      expect(result.parameter).toBe('1');
    });

    it('leaves a natural sentence ending in parentheses untouched', () => {
      const result = humanizeTestName({
        name: 'Cart > rejects an empty cart (regression)',
      });

      expect(result.title).toBe('Rejects an empty cart (regression)');
      expect(result.parameter).toBeUndefined();
    });

    it('strips the test prefix of a method name and preserves acronyms', () => {
      const result = humanizeTestName({
        name: 'testParsesJSONPayload',
        className: 'com.acme.api.PayloadParserTest',
      });

      expect(result.title).toBe('Parses JSON payload');
    });
  });

  describe('googletest junit reporter', () => {
    it('reads Suite.Case from the name', () => {
      const result = humanizeTestName({ name: 'CartTest.RejectsEmptyCart' });

      expect(result.convention).toBe<Convention>('gtest');
      expect(result.path).toEqual(['CartTest']);
      expect(result.title).toBe('Rejects empty cart');
    });

    it('reads a PascalCase case with the suite in the classname', () => {
      const result = humanizeTestName({
        name: 'RejectsEmptyCart',
        className: 'CartTest',
      });

      expect(result.convention).toBe<Convention>('gtest');
      expect(result.path).toEqual(['CartTest']);
      expect(result.title).toBe('Rejects empty cart');
    });
  });

  describe('jest-junit default templates', () => {
    it('does not split when classname and name are the same sentence without a BDD opener', () => {
      const result = humanizeTestName({
        name: 'RunsService ingest creates draft cases',
        className: 'RunsService ingest creates draft cases',
      });

      expect(result.convention).toBe<Convention>('jest-junit');
      expect(result.path).toEqual([]);
      expect(result.title).toBe('RunsService ingest creates draft cases');
    });

    it('splits at the first BDD opener when the sentence has no structural separator', () => {
      const result = humanizeTestName({
        name: 'RunsService ingest should create draft cases',
        className: 'RunsService ingest should create draft cases',
      });

      expect(result.path).toEqual(['RunsService ingest']);
      expect(result.title).toBe('Should create draft cases');
    });

    it('uses the classname as path when the name extends it', () => {
      const result = humanizeTestName({
        name: 'RunsService ingest creates draft cases',
        className: 'RunsService ingest',
      });

      expect(result.path).toEqual(['RunsService ingest']);
      expect(result.title).toBe('Creates draft cases');
    });
  });

  describe('bilingual awareness', () => {
    it('strips Spanish filler prefixes from identifiers', () => {
      const result = humanizeTestName({ name: 'prueba_rechaza_carrito_vacio' });

      expect(result.title).toBe('Rechaza carrito vacio');
    });

    it('keeps a Spanish BDD sentence intact and only fixes the first letter', () => {
      const result = humanizeTestName({
        name: 'Carrito > debería rechazar un carrito vacío cuando no hay ítems',
      });

      expect(result.title).toBe('Debería rechazar un carrito vacío cuando no hay ítems');
    });

    it('splits a Spanish sentence at its BDD opener', () => {
      const result = humanizeTestName({
        name: 'Carrito debería rechazar un carrito vacío',
        className: 'Carrito debería rechazar un carrito vacío',
      });

      expect(result.path).toEqual(['Carrito']);
      expect(result.title).toBe('Debería rechazar un carrito vacío');
    });

    it('never translates', () => {
      const result = humanizeTestName({ name: 'Cart > should reject an empty cart' });

      expect(result.title).toBe('Should reject an empty cart');
    });
  });

  describe('edge cases and safety', () => {
    it('returns an unknown convention with a sentence-cased title for plain text', () => {
      const result = humanizeTestName({ name: 'checks the invoice total' });

      expect(result.convention).toBe<Convention>('unknown');
      expect(result.title).toBe('Checks the invoice total');
    });

    it('keeps the raw name verbatim', () => {
      const raw = '  useCreateRun >  keeps   spacing  ';
      const result = humanizeTestName({ name: raw });

      expect(result.raw).toBe(raw);
      expect(result.title).toBe('Keeps spacing');
    });

    it('falls back to the raw name when only separators are present', () => {
      const result = humanizeTestName({ name: ' > > ' });

      expect(result.title).toBe('> >');
      expect(result.path).toEqual([]);
    });

    it('returns an empty title for an empty name', () => {
      const result = humanizeTestName({ name: '' });

      expect(result.title).toBe('');
      expect(result.path).toEqual([]);
      expect(result.convention).toBe<Convention>('unknown');
    });

    it('removes control characters and normalizes unicode', () => {
      const result = humanizeTestName({ name: `Cart > re${BELL}jects cafe${COMBINING_ACUTE}` });

      expect(result.title).toBe('Rejects café');
    });

    it('caps the title at 200 characters', () => {
      const result = humanizeTestName({ name: `Cart > ${'a'.repeat(700)}` });

      expect(result.title.length).toBeLessThanOrEqual(200);
      expect(result.title.endsWith('…')).toBe(true);
    });

    it('never throws and stays bounded for random input', () => {
      const alphabet = `abcXYZ_-.:>›[]() \t\n é9${BELL}`;
      let seed = 42;
      const next = (): number => {
        seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
        return seed;
      };

      for (let i = 0; i < 1_000; i += 1) {
        const length = next() % 600;
        let name = '';
        for (let j = 0; j < length; j += 1) {
          name += alphabet[next() % alphabet.length];
        }
        const result = humanizeTestName({ name, className: name.slice(0, 40) });

        expect(result.title.length).toBeLessThanOrEqual(200);
        expect(result.raw).toBe(name);
        expect(Array.isArray(result.path)).toBe(true);
      }
    });
  });
});
