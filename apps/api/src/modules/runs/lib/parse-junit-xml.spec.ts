import { parseJunitXml } from './parse-junit-xml';

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

describe('parseJunitXml', () => {
  it('maps a passing testcase', () => {
    const report = parseJunitXml(singleSuite);

    expect(report.cases[0]).toEqual({
      name: 'accepts a valid card',
      suiteName: 'Checkout',
      status: 'pass',
    });
  });

  it('maps a failure to fail', () => {
    const report = parseJunitXml(singleSuite);

    expect(report.cases[1].status).toBe('fail');
  });

  it('maps an error to fail', () => {
    const report = parseJunitXml(singleSuite);

    expect(report.cases[2].status).toBe('fail');
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

  it('rejects malformed xml', () => {
    expect(() => parseJunitXml('<testsuite><testcase></testsuite>')).toThrow();
  });

  it('rejects a report with no testcases', () => {
    expect(() => parseJunitXml('<testsuite name="Empty"/>')).toThrow();
  });

  it('rejects input that is not a junit report', () => {
    expect(() => parseJunitXml('<project><target/></project>')).toThrow();
  });

  it('leaves a doctype entity bomb inert instead of expanding it', () => {
    const declarations = ['  <!ENTITY lol "lollollollollolloll">'];

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

    const report = parseJunitXml(bomb);

    expect(report.cases[0].name).not.toContain('lollol');
    expect(report.cases[0].name.length).toBeLessThanOrEqual(120);
  });
});
