const SEPARATORS = /[/._\-\s>:]+/;
const CAMEL_BOUNDARY = /([a-z0-9])([A-Z])/g;
const MIN_TOKEN_LENGTH = 3;
const GENERIC_TOKENS = new Set([
  'test',
  'spec',
  'src',
  'tests',
  'it',
  'should',
]);

export function tokenize(text: string): Set<string> {
  const withCamelSplit = text.replace(CAMEL_BOUNDARY, '$1 $2');

  const tokens = withCamelSplit
    .split(SEPARATORS)
    .map((token) => token.toLowerCase())
    .filter(
      (token) => token.length >= MIN_TOKEN_LENGTH && !GENERIC_TOKENS.has(token),
    );

  return new Set(tokens);
}

export function jaccardScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }

  const union = a.size + b.size - intersection;

  return union === 0 ? 0 : intersection / union;
}
