import { countTestDeclarations } from './count-test-declarations';

describe('countTestDeclarations', () => {
  it('counts it and test calls for javascript/typescript', () => {
    const content = `
      describe('Cart', () => {
        it('adds an item', () => {})
        test('removes an item', () => {})
      })
    `;

    expect(countTestDeclarations(content, 'javascript')).toBe(2);
  });

  it('counts it.only, it.skip and it.each declarations', () => {
    const content = `
      it.only('adds an item', () => {})
      it.skip('removes an item', () => {})
      it.each([1, 2])('handles %i', (n) => {})
    `;

    expect(countTestDeclarations(content, 'typescript')).toBe(3);
  });

  it('counts it.each template literal declarations', () => {
    const content =
      "it.each`\n  a | b\n  ${1} | ${2}\n`('adds $a and $b', () => {})";

    expect(countTestDeclarations(content, 'typescript')).toBe(1);
  });

  it('counts JUnit-annotated methods for java/kotlin', () => {
    const content = `
      @Test
      void addsAnItem() {}

      @ParameterizedTest
      void handlesMultiple() {}

      @RepeatedTest(3)
      void retriesFlaky() {}
    `;

    expect(countTestDeclarations(content, 'java')).toBe(3);
  });

  it('counts pytest test_ function declarations', () => {
    const content = `
def test_adds_item_to_cart():
    pass

def test_removes_item():
    pass
    `;

    expect(countTestDeclarations(content, 'python')).toBe(2);
  });

  it('counts gtest TEST and TEST_F macros for cpp', () => {
    const content = `
      TEST(CartTest, AddsItem) {}
      TEST_F(CartFixture, RemovesItem) {}
    `;

    expect(countTestDeclarations(content, 'cpp')).toBe(2);
  });

  it('counts Go Test functions', () => {
    const content = `
      func TestAddsItem(t *testing.T) {}
      func TestRemovesItem(t *testing.T) {}
    `;

    expect(countTestDeclarations(content, 'go')).toBe(2);
  });

  it('returns 0 for a file with no test declarations', () => {
    expect(countTestDeclarations('function helper() {}', 'javascript')).toBe(0);
  });

  it('returns 0 for an unrecognized language', () => {
    expect(countTestDeclarations('it("x", () => {})', 'ruby')).toBe(0);
  });
});
