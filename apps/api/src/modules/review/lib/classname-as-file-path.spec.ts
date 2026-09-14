import { classNameAsTestFilePath } from './classname-as-file-path';

describe('classNameAsTestFilePath', () => {
  it('accepts a JS/TS test file path reported as the automation class name', () => {
    expect(classNameAsTestFilePath('src/cart/cart.spec.ts')).toBe(
      'src/cart/cart.spec.ts',
    );
    expect(classNameAsTestFilePath('src/cart/cart.test.tsx')).toBe(
      'src/cart/cart.test.tsx',
    );
  });

  it('accepts a Python test file path in either naming convention', () => {
    expect(classNameAsTestFilePath('tests/cart/test_cart.py')).toBe(
      'tests/cart/test_cart.py',
    );
    expect(classNameAsTestFilePath('tests/cart/cart_test.py')).toBe(
      'tests/cart/cart_test.py',
    );
  });

  it('accepts a Java, Kotlin or Go test file path', () => {
    expect(classNameAsTestFilePath('src/test/java/cart/CartTest.java')).toBe(
      'src/test/java/cart/CartTest.java',
    );
    expect(classNameAsTestFilePath('src/test/java/cart/CartTests.java')).toBe(
      'src/test/java/cart/CartTests.java',
    );
    expect(classNameAsTestFilePath('src/test/kotlin/CartTest.kt')).toBe(
      'src/test/kotlin/CartTest.kt',
    );
    expect(classNameAsTestFilePath('cart/cart_test.go')).toBe(
      'cart/cart_test.go',
    );
  });

  it('normalizes backslashes and a leading ./', () => {
    expect(classNameAsTestFilePath('./src\\cart\\cart.spec.ts')).toBe(
      'src/cart/cart.spec.ts',
    );
  });

  it('rejects a plain class name with no path separator', () => {
    expect(classNameAsTestFilePath('CartTest')).toBeNull();
  });

  it('rejects a dotted class name that is not a recognizable test file', () => {
    expect(classNameAsTestFilePath('cart/CartController')).toBeNull();
  });

  it('returns null for null or undefined input', () => {
    expect(classNameAsTestFilePath(null)).toBeNull();
    expect(classNameAsTestFilePath(undefined)).toBeNull();
  });
});
