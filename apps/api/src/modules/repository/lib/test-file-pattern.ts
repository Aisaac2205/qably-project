const JS_TEST_EXT = /\.(?:test|spec)\.(?:js|jsx|ts|tsx|mjs|cjs)$/;
const PY_TEST_SUFFIX = /_test\.py$/;
const PY_TEST_PREFIX = /(?:^|\/)test_[^/]+\.py$/;
const JAVA_TEST = /Tests?\.java$/;
const KOTLIN_TEST = /Test\.kt$/;
const GO_TEST = /_test\.go$/;
const CPP_TEST_SUFFIX = /_test\.cc$/;
const CPP_TEST_CLASS = /Test\.cpp$/;

export function isTestFilePath(path: string): boolean {
  return (
    JS_TEST_EXT.test(path) ||
    PY_TEST_SUFFIX.test(path) ||
    PY_TEST_PREFIX.test(path) ||
    JAVA_TEST.test(path) ||
    KOTLIN_TEST.test(path) ||
    GO_TEST.test(path) ||
    CPP_TEST_SUFFIX.test(path) ||
    CPP_TEST_CLASS.test(path)
  );
}
