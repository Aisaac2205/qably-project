import { JunitParseError, parseJunitXml } from './parse-junit-xml';

const singleSuite = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="Checkout" tests="4">
  <testcase name="accepts a valid card" classname="checkout.spec" time="0.5"/>
  <testcase name="rejects an expired card" classname="checkout.spec">
    <failure message="expected 200">at checkout.spec.ts:12</failure>
  </testcase>
  <testcase name="retries the webhook" classname="checkout.spec">
    <error message="ECONNRESET">at http.ts:44</error>
  </testcase>
  <testcase name="handles 3D Secure" classname="checkout.spec">
    <skipped/>
  </testcase>
</testsuite>`;

const nestedSuites = `<testsuites name="e2e" tests="2">
  <testsuite name="Checkout">
    <testcase name="adds to cart"/>
  </testsuite>
  <testsuite name="Billing">
    <testcase name="charges once">
      <failure message="boom"/>
    </testcase>
  </testsuite>
</testsuites>`;

function hasLoneSurrogate(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint >= 0xd800 && codePoint <= 0xdfff;
  });
}

describe('parseJunitXml', () => {
  it('maps a passing testcase', () => {
    const report = parseJunitXml(singleSuite);

    expect(report.cases[0]).toEqual({
      name: 'accepts a valid card',
      suiteName: 'Checkout',
      suiteKey: 'Checkout',
      status: 'pass',
      className: 'checkout.spec',
      durationMs: 500,
    });
  });

  it('maps a failure to fail with type, message and body', () => {
    const report = parseJunitXml(singleSuite);

    expect(report.cases[1].status).toBe('fail');
    expect(report.cases[1].failureMessage).toBe('expected 200');
    expect(report.cases[1].failureDetails).toBe('at checkout.spec.ts:12');
  });

  it('maps an error to fail with its message', () => {
    const report = parseJunitXml(singleSuite);

    expect(report.cases[2].status).toBe('fail');
    expect(report.cases[2].failureMessage).toBe('ECONNRESET');
    expect(report.cases[2].failureDetails).toBe('at http.ts:44');
  });

  it('maps a skipped testcase to skip', () => {
    const report = parseJunitXml(singleSuite);

    expect(report.cases[3].status).toBe('skip');
  });

  it('reads the suite name from a single testsuite root', () => {
    expect(parseJunitXml(singleSuite).suiteName).toBe('Checkout');
  });

  it('walks every testsuite under a testsuites root', () => {
    const report = parseJunitXml(nestedSuites);

    expect(report.cases).toHaveLength(2);
    expect(report.cases.map((item) => item.suiteName)).toEqual([
      'Checkout',
      'Billing',
    ]);
    expect(report.suiteName).toBe('e2e');
  });

  it('handles a suite holding exactly one testcase', () => {
    const report = parseJunitXml(
      '<testsuite name="Solo"><testcase name="only one"/></testsuite>',
    );

    expect(report.cases).toHaveLength(1);
    expect(report.cases[0].name).toBe('only one');
  });

  it('decodes predefined entities in names', () => {
    const report = parseJunitXml(
      '<testsuite name="A &amp; B"><testcase name="x &lt; y"/></testsuite>',
    );

    expect(report.suiteName).toBe('A & B');
    expect(report.cases[0].name).toBe('x < y');
  });

  it('falls back to the classname when a testcase has no name', () => {
    const report = parseJunitXml(
      '<testsuite name="S"><testcase classname="pkg.Case"/></testsuite>',
    );

    expect(report.cases[0].name).toBe('pkg.Case');
  });

  it('truncates names to the ingestion limit', () => {
    const long = 'x'.repeat(200);
    const report = parseJunitXml(
      `<testsuite name="${long}"><testcase name="${long}"/></testsuite>`,
    );

    expect(report.suiteName).toHaveLength(120);
    expect(report.cases[0].name).toHaveLength(120);
  });

  it('keeps the untruncated suite name as the grouping key', () => {
    const long = `${'p'.repeat(118)}/alpha.test.ts`;
    const report = parseJunitXml(
      `<testsuite name="${long}"><testcase name="x"/></testsuite>`,
    );

    expect(report.cases[0].suiteName).toHaveLength(120);
    expect(report.cases[0].suiteKey).toBe(long);
    expect(report.suiteKey).toBe(long);
  });

  it('truncates on code points so a surrogate pair is never split', () => {
    const emoji = String.fromCodePoint(0x1f600);
    const name = `${'a'.repeat(119)}${emoji}${emoji}`;
    const details = `${'b'.repeat(3999)}${emoji}${emoji}`;
    const report = parseJunitXml(
      `<testsuite name="S"><testcase name="${name}"><failure message="m">${details}</failure></testcase></testsuite>`,
    );

    const parsed = report.cases[0];
    expect(hasLoneSurrogate(parsed.name)).toBe(false);
    expect(Array.from(parsed.name)).toHaveLength(120);
    expect(hasLoneSurrogate(parsed.failureDetails ?? '')).toBe(false);
    expect(Array.from(parsed.failureDetails ?? '')).toHaveLength(4000);
  });

  it('caps durationMs at the largest 32-bit integer', () => {
    const report = parseJunitXml(
      '<testsuite name="S"><testcase name="x" time="9999999999"/></testsuite>',
    );

    expect(report.cases[0].durationMs).toBe(2_147_483_647);
  });

  it('rejects malformed xml', () => {
    expect(() => parseJunitXml('<testsuite><testcase></testsuite>')).toThrow();
  });

  it('rejects a report with no testcases', () => {
    expect(() => parseJunitXml('<testsuite name="Empty"/>')).toThrow();
  });

  it('rejects input that is not a junit report', () => {
    expect(() => parseJunitXml('<project><target/></project>')).toThrow();
  });

  it('parses a report with hundreds of predefined entities across names and failure messages', () => {
    const cases = Array.from({ length: 60 }, (_unused, index) => {
      const name = `suite &quot;${index}&quot; handles &lt;input&gt; &amp; &apos;output&apos;`;
      const message = `expected &lt;div&gt; to contain &quot;value ${index}&quot; &amp; &apos;more&apos;`;
      return `<testcase name="${name}"><failure message="${message}">at case ${index}</failure></testcase>`;
    }).join('');

    const xml = `<testsuites name="ci"><testsuite name="Suite &amp; Co">${cases}</testsuite></testsuites>`;

    const report = parseJunitXml(xml);

    expect(report.suiteName).toBe('ci');
    expect(report.cases).toHaveLength(60);
    expect(report.cases[0].suiteName).toBe('Suite & Co');
    expect(report.cases[0].name).toBe('suite "0" handles <input> & \'output\'');
    expect(report.cases[0].failureMessage).toBe(
      'expected <div> to contain "value 0" & \'more\'',
    );
    expect(report.cases[59].name).toBe(
      'suite "59" handles <input> & \'output\'',
    );
  });

  it('rejects a billion-laughs document instead of expanding nested custom entities', () => {
    const declarations = ['  <!ENTITY lol "lol">'];

    for (let level = 2; level <= 7; level += 1) {
      const previous = level === 2 ? 'lol' : `lol${level - 1}`;
      const body = new Array(8).fill(`&${previous};`).join('');
      declarations.push(`  <!ENTITY lol${level} "${body}">`);
    }

    const bomb = [
      '<?xml version="1.0"?>',
      '<!DOCTYPE lolz [',
      ...declarations,
      ']>',
      '<testsuite name="s"><testcase name="&lol7;"/></testsuite>',
    ].join('\n');

    expect(() => parseJunitXml(bomb)).toThrow(JunitParseError);

    try {
      parseJunitXml(bomb);
      throw new Error('expected parseJunitXml to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(JunitParseError);
      expect((error as JunitParseError).code).toBe('doctype-not-allowed');
    }
  });

  it('rejects a document declaring an external entity without attempting to resolve it', () => {
    const xxe = [
      '<?xml version="1.0"?>',
      '<!DOCTYPE testsuite [',
      '  <!ENTITY xxe SYSTEM "http://203.0.113.1:9999/should-not-be-fetched">',
      ']>',
      '<testsuite name="s"><testcase name="&xxe;"/></testsuite>',
    ].join('\n');

    const startedAt = Date.now();

    expect(() => parseJunitXml(xxe)).toThrow(JunitParseError);

    expect(Date.now() - startedAt).toBeLessThan(200);

    try {
      parseJunitXml(xxe);
      throw new Error('expected parseJunitXml to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(JunitParseError);
      expect((error as JunitParseError).code).toBe('doctype-not-allowed');
    }
  });

  it('rejects a harmless DOCTYPE with no entity declarations, with the same clear message', () => {
    const xml = [
      '<?xml version="1.0"?>',
      '<!DOCTYPE testsuite>',
      '<testsuite name="s"><testcase name="ok"/></testsuite>',
    ].join('\n');

    expect(() => parseJunitXml(xml)).toThrow(
      'junit xml must not declare a DOCTYPE',
    );

    try {
      parseJunitXml(xml);
      throw new Error('expected parseJunitXml to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(JunitParseError);
      expect((error as JunitParseError).code).toBe('doctype-not-allowed');
    }
  });

  it('throws a typed error when testsuite nesting exceeds the depth limit', () => {
    let xml = '<testcase name="deep"/>';

    for (let level = 0; level < 40; level += 1) {
      xml = `<testsuite name="level-${level}">${xml}</testsuite>`;
    }

    expect(() => parseJunitXml(xml)).toThrow(JunitParseError);

    try {
      parseJunitXml(xml);
      throw new Error('expected parseJunitXml to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(JunitParseError);
      expect((error as JunitParseError).code).toBe('depth-exceeded');
    }
  });

  it('throws a typed error when the report exceeds the testcase limit', () => {
    const many = Array.from(
      { length: 10_001 },
      (_unused, index) => `<testcase name="t${index}"/>`,
    ).join('');
    const xml = `<testsuite name="Big">${many}</testsuite>`;

    expect(() => parseJunitXml(xml)).toThrow(JunitParseError);

    try {
      parseJunitXml(xml);
      throw new Error('expected parseJunitXml to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(JunitParseError);
      expect((error as JunitParseError).code).toBe('testcase-limit-exceeded');
    }
  });

  it('ignores a non-numeric time instead of throwing', () => {
    const report = parseJunitXml(
      '<testsuite name="S"><testcase name="x" time="not-a-number"/></testsuite>',
    );

    expect(report.cases[0].durationMs).toBeUndefined();
  });

  it('skips a testcase with neither a name nor a classname', () => {
    const report = parseJunitXml(
      '<testsuite name="S"><testcase time="0.1"/><testcase name="kept"/></testsuite>',
    );

    expect(report.cases).toHaveLength(1);
    expect(report.cases[0].name).toBe('kept');
  });

  it('truncates failureMessage, failureDetails and skipReason to their limits', () => {
    const longMessage = 'm'.repeat(2_000);
    const longDetails = 'd'.repeat(5_000);
    const longReason = 'r'.repeat(1_000);
    const xml = `<testsuite name="S">
      <testcase name="a"><failure message="${longMessage}">${longDetails}</failure></testcase>
      <testcase name="b"><skipped message="${longReason}"/></testcase>
    </testsuite>`;

    const report = parseJunitXml(xml);

    expect(report.cases[0].failureMessage).toHaveLength(1000);
    expect(report.cases[0].failureDetails).toHaveLength(4000);
    expect(report.cases[1].skipReason).toHaveLength(500);
  });

  it('parses a vitest report: file-path suite/classname and a describe chain joined by " > "', () => {
    const report = parseJunitXml(
      `<testsuites name="vitest tests" tests="1">
        <testsuite name="src/features/checkout/checkout.test.ts" tests="1">
          <testcase classname="src/features/checkout/checkout.test.ts" name="Checkout > adds item > shows a toast" time="0.012">
            <system-out>console output</system-out>
          </testcase>
        </testsuite>
      </testsuites>`,
    );

    expect(report.cases[0].name).toBe('Checkout > adds item > shows a toast');
    expect(report.cases[0].className).toBe(
      'src/features/checkout/checkout.test.ts',
    );
    expect(report.cases[0].durationMs).toBe(12);
  });

  it('parses a jest-junit report: name is "{classname} {title}"', () => {
    const report = parseJunitXml(
      `<testsuites name="jest tests">
        <testsuite name="src/features/checkout/checkout.test.tsx" tests="1">
          <testcase classname="src/features/checkout/checkout.test.tsx" name="src/features/checkout/checkout.test.tsx renders the checkout button" time="0.5"/>
        </testsuite>
      </testsuites>`,
    );

    expect(report.cases[0].name).toBe(
      'src/features/checkout/checkout.test.tsx renders the checkout button',
    );
    expect(report.cases[0].className).toBe(
      'src/features/checkout/checkout.test.tsx',
    );
    expect(report.cases[0].durationMs).toBe(500);
  });

  it('parses a surefire report with a testsuite nested inside a testsuite and dotted classnames', () => {
    const report = parseJunitXml(
      `<testsuite name="com.qably.CheckoutTests" tests="2">
        <testsuite name="com.qably.CheckoutTests$Nested" tests="1">
          <testcase classname="com.qably.CheckoutTests$Nested" name="appliesDiscount" time="0.2"/>
        </testsuite>
        <testcase classname="com.qably.CheckoutTests" name="addsItem" time="0.1"/>
      </testsuite>`,
    );

    expect(report.cases.map((item) => item.suiteName)).toEqual([
      'com.qably.CheckoutTests',
      'com.qably.CheckoutTests$Nested',
    ]);
    expect(report.cases[0].durationMs).toBe(100);
    expect(report.cases[1].durationMs).toBe(200);
  });

  it('parses a pytest report: dotted classname, a file attribute and a skip reason', () => {
    const report = parseJunitXml(
      `<testsuite name="pytest" tests="1">
        <testcase classname="tests.checkout.test_checkout" name="test_applies_discount" file="tests/checkout/test_checkout.py" time="0.03">
          <skipped message="requires network"/>
        </testcase>
      </testsuite>`,
    );

    expect(report.cases[0].className).toBe('tests.checkout.test_checkout');
    expect(report.cases[0].filePath).toBe('tests/checkout/test_checkout.py');
    expect(report.cases[0].status).toBe('skip');
    expect(report.cases[0].skipReason).toBe('requires network');
  });

  it('parses a playwright report: name joined by " › " and a file attribute', () => {
    const report = parseJunitXml(
      `<testsuites name="Playwright Tests" tests="1">
        <testsuite name="checkout.spec.ts" tests="1">
          <testcase classname="checkout.spec.ts" name="Checkout › completes purchase › shows confirmation" time="1.234" file="e2e/checkout.spec.ts"/>
        </testsuite>
      </testsuites>`,
    );

    expect(report.cases[0].name).toBe(
      'Checkout › completes purchase › shows confirmation',
    );
    expect(report.cases[0].filePath).toBe('e2e/checkout.spec.ts');
    expect(report.cases[0].durationMs).toBe(1234);
  });

  it('parses a googletest report: "Suite.Case" naming and a failure body', () => {
    const report = parseJunitXml(
      `<testsuites name="AllTests" tests="1">
        <testsuite name="CheckoutTest" tests="1">
          <testcase name="HandlesRefund" classname="CheckoutTest" time="0.045">
            <failure message="expected true" type="AssertionError">Value of: refunded
Actual: false
Expected: true</failure>
          </testcase>
        </testsuite>
      </testsuites>`,
    );

    expect(report.cases[0].status).toBe('fail');
    expect(report.cases[0].failureType).toBe('AssertionError');
    expect(report.cases[0].failureMessage).toBe('expected true');
    expect(report.cases[0].failureDetails).toContain('Value of: refunded');
  });
});
