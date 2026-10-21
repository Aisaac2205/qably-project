import { describe, expect, it } from 'vitest';
import {
  MAX_INLINE_LENGTH,
  collectInlineLinks,
  inspectInline,
  parseInline,
  stripInline,
  type InlineNode,
} from './inline';

const text = (value: string): InlineNode => ({ type: 'text', value });
const code = (value: string): InlineNode => ({ type: 'code', value });
const strong = (...children: InlineNode[]): InlineNode => ({ type: 'strong', children });
const docsLink = (slug: string | null, anchor: string | null, ...children: InlineNode[]): InlineNode => ({
  type: 'link',
  href: { kind: 'docs', slug, anchor },
  children,
});
const externalLink = (url: string, ...children: InlineNode[]): InlineNode => ({
  type: 'link',
  href: { kind: 'external', url },
  children,
});

describe('parseInline: plain text', () => {
  it('returns nothing for an empty string', () => {
    expect(parseInline('')).toEqual([]);
  });

  it('returns one text node for text without markup', () => {
    expect(parseInline('Qably stores the results of your CI.')).toEqual([
      text('Qably stores the results of your CI.'),
    ]);
  });

  it('keeps single asterisks, underscores and other punctuation as they are', () => {
    expect(parseInline('a * b _c_ ~d~ #e')).toEqual([text('a * b _c_ ~d~ #e')]);
  });

  it('keeps the API base URL token untouched so resolve-content can replace it', () => {
    expect(parseInline('POST {{API_BASE_URL}}/runs/ingest')).toEqual([text('POST {{API_BASE_URL}}/runs/ingest')]);
  });
});

describe('parseInline: bold', () => {
  it('parses **bold** between text', () => {
    expect(parseInline('a **b** c')).toEqual([text('a '), strong(text('b')), text(' c')]);
  });

  it('may contain code, which stays verbatim', () => {
    expect(parseInline('**run `npm test`**')).toEqual([strong(text('run '), code('npm test'))]);
  });

  it('may contain a link', () => {
    expect(parseInline('**see [the guide](/docs/quickstart)**')).toEqual([
      strong(text('see '), docsLink('quickstart', null, text('the guide'))),
    ]);
  });

  it('does not nest: an inner ** that cannot close stays literal', () => {
    expect(parseInline('**a **b** c**')).toEqual([strong(text('a **b')), text(' c**')]);
  });

  it('closes on the first ** that follows a non-space character', () => {
    expect(parseInline('**a** and **b**')).toEqual([strong(text('a')), text(' and '), strong(text('b'))]);
  });

  it('ignores a ** that sits inside a code span', () => {
    expect(parseInline('**a `**` b**')).toEqual([strong(text('a '), code('**'), text(' b'))]);
  });

  it('parses adjacent bold spans separately', () => {
    expect(parseInline('**a****b**')).toEqual([strong(text('a')), strong(text('b'))]);
  });

  it('needs a non-space character after the opening and before the closing marker', () => {
    expect(parseInline('2 ** 3 ** 4')).toEqual([text('2 ** 3 ** 4')]);
    expect(parseInline('** spaced**')).toEqual([text('** spaced**')]);
    expect(parseInline('**spaced **')).toEqual([text('**spaced **')]);
  });
});

describe('parseInline: code', () => {
  it('parses `code` as one verbatim node', () => {
    expect(parseInline('use `junit.xml` here')).toEqual([text('use '), code('junit.xml'), text(' here')]);
  });

  it('never parses markup inside code', () => {
    expect(parseInline('`**not bold** [x](/docs/a) <b>`')).toEqual([code('**not bold** [x](/docs/a) <b>')]);
  });

  it('keeps spaces and angle brackets inside code', () => {
    expect(parseInline('`<testsuite name="x">`')).toEqual([code('<testsuite name="x">')]);
  });

  it('parses adjacent code spans separately', () => {
    expect(parseInline('`a``b`')).toEqual([code('a'), code('b')]);
  });

  it('parses code directly after bold', () => {
    expect(parseInline('**a**`b`')).toEqual([strong(text('a')), code('b')]);
  });
});

describe('parseInline: unmatched markers stay literal', () => {
  it.each([
    ['**open'],
    ['close**'],
    ['**'],
    ['****'],
    ['`'],
    ['``'],
    ['a ` b'],
    ['[label'],
    ['[label]'],
    ['[label](/docs/x'],
    ['](/docs/x)'],
    ['[label] (/docs/x)'],
  ])('keeps %j as plain text', (input) => {
    expect(parseInline(input)).toEqual([text(input)]);
  });

  it('still parses the markup that follows an unmatched marker', () => {
    expect(parseInline('**open `code` here')).toEqual([text('**open '), code('code'), text(' here')]);
    expect(parseInline('a ` b **c**')).toEqual([text('a ` b '), strong(text('c'))]);
  });
});

describe('parseInline: links', () => {
  it('parses an internal docs link with an anchor', () => {
    expect(parseInline('see [the key page](/docs/api-keys#create-a-key) now')).toEqual([
      text('see '),
      docsLink('api-keys', 'create-a-key', text('the key page')),
      text(' now'),
    ]);
  });

  it('parses an internal docs link without an anchor', () => {
    expect(parseInline('[Quickstart](/docs/quickstart)')).toEqual([docsLink('quickstart', null, text('Quickstart'))]);
  });

  it('parses the docs root, which is the overview', () => {
    expect(parseInline('[Docs](/docs)')).toEqual([docsLink(null, null, text('Docs'))]);
    expect(parseInline('[Docs](/docs#getting-started)')).toEqual([docsLink(null, 'getting-started', text('Docs'))]);
  });

  it('parses an external https link', () => {
    expect(parseInline('[Spec](https://example.com/spec?a=1#top)')).toEqual([
      externalLink('https://example.com/spec?a=1#top', text('Spec')),
    ]);
  });

  it('allows code inside a label, verbatim', () => {
    expect(parseInline('[`POST /runs/ingest`](/docs/api-ingest)')).toEqual([
      docsLink('api-ingest', null, code('POST /runs/ingest')),
    ]);
  });

  it('keeps bold markers inside a label literal', () => {
    expect(parseInline('[**x**](/docs/api-keys)')).toEqual([docsLink('api-keys', null, text('**x**'))]);
  });

  it('keeps an empty or blank label literal instead of rendering an empty link', () => {
    expect(parseInline('[](/docs/api-keys)')).toEqual([text('[](/docs/api-keys)')]);
    expect(parseInline('[  ](/docs/api-keys)')).toEqual([text('[  ](/docs/api-keys)')]);
  });

  it('parses two links in a row', () => {
    expect(parseInline('[a](/docs/x)[b](/docs/y)')).toEqual([
      docsLink('x', null, text('a')),
      docsLink('y', null, text('b')),
    ]);
  });
});

describe('parseInline: rejected link targets render the label as plain text', () => {
  it.each([
    ['javascript:', '[x](javascript:alert)'],
    ['uppercase javascript:', '[x](JAVASCRIPT:alert)'],
    ['data:', '[x](data:text/html;base64,PHNjcmlwdD4=)'],
    ['vbscript:', '[x](vbscript:msgbox)'],
    ['protocol-relative', '[x](//evil.dev/a)'],
    ['plain http', '[x](http://example.com)'],
    ['a relative path', '[x](quickstart)'],
    ['the localized path', '[x](/en/docs/quickstart)'],
    ['a path outside the docs', '[x](/privacy)'],
    ['a docs path that goes up', '[x](/docs/../secret)'],
    ['an uppercase slug', '[x](/docs/Quickstart)'],
    ['an underscore slug', '[x](/docs/quick_start)'],
    ['a nested slug', '[x](/docs/a/b)'],
    ['an empty anchor', '[x](/docs/quickstart#)'],
    ['an anchor with a space', '[x](/docs/quickstart#a b)'],
    ['credentials in the URL', '[x](https://user:pw@example.com/)'],
    ['a URL without a host', '[x](https://)'],
    ['a URL without a dot in the host', '[x](https://localhost/a)'],
    ['a quote in the URL', '[x](https://example.com/"onmouseover="a)'],
    ['an angle bracket in the URL', '[x](https://example.com/<b>)'],
    ['a space in the URL', '[x](https://example.com/a b)'],
    ['a leading space', '[x]( https://example.com/)'],
    ['an empty target', '[x]()'],
    ['an unresolved token', '[x]({{API_BASE_URL}}/health)'],
  ])('rejects %s', (_name, input) => {
    expect(parseInline(input)).toEqual([text('x')]);
    expect(collectInlineLinks(input)).toEqual([]);
  });
});

describe('parseInline: link target boundaries', () => {
  it('ends the target at the first closing parenthesis', () => {
    expect(parseInline('[x](javascript:alert(1))')).toEqual([text('x)')]);
    expect(parseInline('[x](/docs/quickstart) (and more)')).toEqual([
      docsLink('quickstart', null, text('x')),
      text(' (and more)'),
    ]);
  });
});

describe('parseInline: escaping by construction', () => {
  it('returns HTML-looking text as plain text, never as markup', () => {
    const input = '<script>alert(1)</script> & "quotes" \'single\' <img src=x onerror=y>';

    expect(parseInline(input)).toEqual([text(input)]);
  });

  it('keeps HTML-looking text inside bold and code verbatim', () => {
    expect(parseInline('**<b>x</b>** `<i>y</i>`')).toEqual([strong(text('<b>x</b>')), text(' '), code('<i>y</i>')]);
  });

  it('keeps HTML-looking text inside a link label verbatim', () => {
    expect(parseInline('[<b>x</b> & y](/docs/x)')).toEqual([docsLink('x', null, text('<b>x</b> & y'))]);
  });

  it('never returns a node type that carries raw HTML', () => {
    const nodes = parseInline('<a href="javascript:alert(1)">x</a> **b** `c` [d](/docs/e)');
    const kinds = new Set<string>();
    const visit = (list: InlineNode[]): void => {
      for (const node of list) {
        kinds.add(node.type);
        if (node.type === 'strong' || node.type === 'link') visit(node.children);
      }
    };

    visit(nodes);

    expect([...kinds].sort()).toEqual(['code', 'link', 'strong', 'text']);
  });
});

describe('parseInline: size limit', () => {
  it('returns very long input as one plain text node without parsing it', () => {
    const input = '**a** '.repeat(MAX_INLINE_LENGTH);

    expect(parseInline(input)).toEqual([text(input)]);
  });

  it('survives a megabyte of unmatched markers', () => {
    const input = '[`**'.repeat(250_000);

    expect(parseInline(input)).toEqual([text(input)]);
  });

  it('parses input right at the limit', () => {
    const input = `**a**${'x'.repeat(MAX_INLINE_LENGTH - 5)}`;

    expect(input).toHaveLength(MAX_INLINE_LENGTH);
    expect(parseInline(input)[0]).toEqual(strong(text('a')));
  });

  it('finishes on a pathological run of unmatched openers just under the limit', () => {
    const input = '**a '.repeat(MAX_INLINE_LENGTH / 4);

    expect(stripInline(input)).toBe(input);
  });
});

describe('stripInline', () => {
  it('removes markers and keeps the words', () => {
    expect(stripInline('a **b** `c` [d](/docs/e#f) g')).toBe('a b c d g');
  });

  it('keeps the label of a rejected link and the markers that matched nothing', () => {
    expect(stripInline('[x](javascript:alert) **open')).toBe('x **open');
  });

  it('returns text without markup unchanged', () => {
    expect(stripInline('Plain text, 100% plain.')).toBe('Plain text, 100% plain.');
  });

  it('keeps the words of a phrase split by markup so a guard can still match it', () => {
    expect(stripInline('the only **repository provider** supported `today`')).toBe(
      'the only repository provider supported today',
    );
  });
});

describe('collectInlineLinks', () => {
  it('lists every valid link in reading order, including those inside bold', () => {
    expect(collectInlineLinks('[a](/docs/x#y) **[b](https://example.com)** [c](nope)')).toEqual([
      { kind: 'docs', slug: 'x', anchor: 'y' },
      { kind: 'external', url: 'https://example.com' },
    ]);
  });

  it('returns nothing for text without links', () => {
    expect(collectInlineLinks('no links **here**')).toEqual([]);
  });
});

describe('inspectInline', () => {
  it('returns the same nodes as parseInline', () => {
    const input = 'a **b** `c` [d](/docs/e)';

    expect(inspectInline(input).nodes).toEqual(parseInline(input));
  });

  it('lists the targets of the links it rejected, in reading order', () => {
    expect(inspectInline('[a](javascript:alert) ok [b](/docs/x) [c](http://example.com)').rejectedTargets).toEqual([
      'javascript:alert',
      'http://example.com',
    ]);
  });

  it('lists a rejected target inside bold too', () => {
    expect(inspectInline('**[a](data:text/html,x)**').rejectedTargets).toEqual(['data:text/html,x']);
  });

  it('lists nothing for text without a rejected link', () => {
    expect(inspectInline('**a** `[b](javascript:x)` [](/docs/x)').rejectedTargets).toEqual([]);
  });
});
