import { detectLanguage } from './detect-language';

describe('detectLanguage', () => {
  it.each([
    ['src/cart.spec.ts', 'typescript'],
    ['src/Cart.tsx', 'typescript'],
    ['src/cart.test.js', 'javascript'],
    ['tests/test_cart.py', 'python'],
    ['src/CartTest.java', 'java'],
    ['src/CartTest.kt', 'kotlin'],
    ['cmd/cart_test.go', 'go'],
    ['src/CartTests.cs', 'csharp'],
    ['README', 'other'],
    ['fixtures/data.unknownext', 'other'],
  ] as const)('maps %s to %s', (filePath, expected) => {
    expect(detectLanguage(filePath)).toBe(expected);
  });
});
