const JS_TEST_CALL = /\b(?:it|test)(?:\.only|\.skip|\.each\([^)]*\))?\s*\(/g;
const JS_EACH_TEMPLATE = /\b(?:it|test)\.each`/g;
const JUNIT_ANNOTATION =
  /@(?:Test|ParameterizedTest|RepeatedTest|TestFactory|TestTemplate)\b/g;
const PYTEST_FUNCTION = /^\s*def\s+test_\w+/gm;
const GTEST_MACRO = /\bTEST(?:_F|_P)?\s*\(/g;
const GO_TEST_FUNCTION = /^\s*func\s+Test\w+\s*\(/gm;

const PATTERNS: Record<string, RegExp[]> = {
  javascript: [JS_TEST_CALL, JS_EACH_TEMPLATE],
  typescript: [JS_TEST_CALL, JS_EACH_TEMPLATE],
  java: [JUNIT_ANNOTATION],
  kotlin: [JUNIT_ANNOTATION],
  python: [PYTEST_FUNCTION],
  cpp: [GTEST_MACRO],
  go: [GO_TEST_FUNCTION],
};

function countMatches(content: string, pattern: RegExp): number {
  const matches = content.match(pattern);
  return matches === null ? 0 : matches.length;
}

export function countTestDeclarations(
  content: string,
  language: string,
): number {
  const patterns = PATTERNS[language];
  if (patterns === undefined) return 0;

  return patterns.reduce(
    (total, pattern) => total + countMatches(content, pattern),
    0,
  );
}
