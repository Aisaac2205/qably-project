import { isTestFilePath } from './test-file-pattern';

describe('isTestFilePath', () => {
  it('accepts JS/TS test and spec files', () => {
    expect(isTestFilePath('src/cart/cart.spec.ts')).toBe(true);
    expect(isTestFilePath('src/cart/cart.test.tsx')).toBe(true);
    expect(isTestFilePath('src/cart/cart.test.mjs')).toBe(true);
  });

  it('accepts e2e spec files written with a hyphenated e2e-spec suffix', () => {
    expect(isTestFilePath('test/app.e2e-spec.ts')).toBe(true);
    expect(isTestFilePath('test/auth/login.e2e-spec.js')).toBe(true);
    expect(isTestFilePath('test/auth/login.e2e.spec.ts')).toBe(true);
  });

  it('accepts Python test files in either naming convention', () => {
    expect(isTestFilePath('tests/cart/test_cart.py')).toBe(true);
    expect(isTestFilePath('tests/cart/cart_test.py')).toBe(true);
  });

  it('accepts Java, Kotlin and Go test files', () => {
    expect(isTestFilePath('src/test/java/cart/CartTest.java')).toBe(true);
    expect(isTestFilePath('src/test/java/cart/CartTests.java')).toBe(true);
    expect(isTestFilePath('src/test/kotlin/CartTest.kt')).toBe(true);
    expect(isTestFilePath('cart/cart_test.go')).toBe(true);
  });

  it('accepts C++ test files', () => {
    expect(isTestFilePath('cart/cart_test.cc')).toBe(true);
    expect(isTestFilePath('cart/CartTest.cpp')).toBe(true);
  });

  it('rejects a source file that is not a test', () => {
    expect(isTestFilePath('src/cart/cart.ts')).toBe(false);
    expect(isTestFilePath('src/cart/CartController.java')).toBe(false);
  });
});
