import {
  detectConvention,
  isIdentifier,
  isPathLike,
  lastDottedSegment,
  separators,
  type Convention,
  type HumanizedTest,
  type TestNameInput,
} from './conventions';
import { BDD_OPENERS, FILLER_PREFIXES } from './lexicon';
import { clampWithEllipsis, MAX_TITLE_LENGTH, sanitize } from './sanitize';

interface SplitName {
  readonly path: readonly string[];
  readonly leaf: string;
}

interface ParameterizedLeaf {
  readonly leaf: string;
  readonly parameter?: string;
}

const LOWER_TO_UPPER_BOUNDARY = /(\p{Ll}|\p{N})(\p{Lu})/gu;
const ACRONYM_TO_WORD_BOUNDARY = /(\p{Lu}+)(\p{Lu}\p{Ll})/gu;
const IDENTIFIER_SEPARATORS = /[_\-.$]+/gu;
const ACRONYM = /^[\p{Lu}\p{N}]{2,}$/u;
const MAX_PARAMETER_LENGTH = 120;

function splitOnSeparator(name: string, separator: string, dropPathLikeHead: boolean): SplitName {
  const segments = name
    .split(separator)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
  const head = segments[0];
  if (dropPathLikeHead && head !== undefined && segments.length > 1 && isPathLike(head)) {
    segments.shift();
  }
  const leaf = segments.pop();
  if (leaf === undefined) {
    return { path: [], leaf: name };
  }
  return { path: segments, leaf };
}

function splitPytest(name: string, className: string | undefined): SplitName {
  if (name.includes(separators.pytest)) {
    return splitOnSeparator(name, separators.pytest, true);
  }
  return { path: className === undefined ? [] : [lastDottedSegment(className)], leaf: name };
}

function splitGtest(name: string, className: string | undefined): SplitName {
  const dot = name.indexOf('.');
  if (dot > 0 && className === undefined) {
    return { path: [name.slice(0, dot)], leaf: name.slice(dot + 1) };
  }
  return { path: className === undefined ? [] : [className], leaf: name };
}

function splitBySentenceOpener(name: string): SplitName {
  const words = name.split(' ');
  for (let index = 1; index < words.length; index += 1) {
    const word = words[index];
    if (word !== undefined && BDD_OPENERS.has(word.toLowerCase())) {
      return { path: [words.slice(0, index).join(' ')], leaf: words.slice(index).join(' ') };
    }
  }
  return { path: [], leaf: name };
}

function splitJestJunit(name: string, className: string | undefined): SplitName {
  if (className !== undefined && className !== name && name.startsWith(`${className} `)) {
    return { path: [className], leaf: name.slice(className.length + 1) };
  }
  return splitBySentenceOpener(name);
}

function splitName(name: string, className: string | undefined, convention: Convention): SplitName {
  switch (convention) {
    case 'vitest':
      return splitOnSeparator(name, separators.vitest, false);
    case 'playwright':
      return splitOnSeparator(name, separators.playwright, true);
    case 'pytest':
      return splitPytest(name, className);
    case 'junit-java':
      return { path: className === undefined ? [] : [lastDottedSegment(className)], leaf: name };
    case 'gtest':
      return splitGtest(name, className);
    case 'jest-junit':
      return splitJestJunit(name, className);
    case 'unknown':
      return { path: [], leaf: name };
    default: {
      const exhaustive: never = convention;
      return exhaustive;
    }
  }
}

function extractParameter(leaf: string): ParameterizedLeaf {
  if (!leaf.endsWith(']')) {
    return { leaf };
  }
  const open = leaf.lastIndexOf('[');
  if (open <= 0) {
    return { leaf };
  }
  const parameter = leaf.slice(open + 1, -1).trim();
  const base = leaf.slice(0, open).trim();
  if (parameter.length === 0 || parameter.length > MAX_PARAMETER_LENGTH || base.length === 0) {
    return { leaf };
  }
  return { leaf: base, parameter };
}

function splitIdentifier(identifier: string): string[] {
  return identifier
    .replace(LOWER_TO_UPPER_BOUNDARY, '$1 $2')
    .replace(ACRONYM_TO_WORD_BOUNDARY, '$1 $2')
    .replace(IDENTIFIER_SEPARATORS, ' ')
    .split(' ')
    .filter((word) => word.length > 0);
}

function stripFillerPrefixes(words: readonly string[]): readonly string[] {
  let start = 0;
  while (start < words.length - 1) {
    const word = words[start];
    if (word === undefined || !FILLER_PREFIXES.has(word.toLowerCase())) {
      break;
    }
    start += 1;
  }
  return words.slice(start);
}

function capitalizeFirst(value: string): string {
  const characters = Array.from(value);
  const first = characters[0];
  if (first === undefined) {
    return '';
  }
  return `${first.toLocaleUpperCase()}${characters.slice(1).join('')}`;
}

function sentenceCaseWords(words: readonly string[]): string {
  const normalized = words.map((word) => (ACRONYM.test(word) ? word : word.toLocaleLowerCase()));
  const sentence = normalized.join(' ');
  return capitalizeFirst(sentence);
}

function humanizeLeaf(leaf: string): string {
  if (leaf.length === 0) {
    return '';
  }
  if (isIdentifier(leaf) || (!leaf.includes(' ') && splitIdentifier(leaf).length > 1)) {
    const words = stripFillerPrefixes(splitIdentifier(leaf));
    if (words.length > 0) {
      return sentenceCaseWords(words);
    }
  }
  return capitalizeFirst(leaf);
}

export function humanizeTestName(input: TestNameInput): HumanizedTest {
  const raw = input.name;
  const name = sanitize(input.name);
  const className = input.className === undefined ? undefined : sanitize(input.className);
  const filePath = input.filePath === undefined ? undefined : sanitize(input.filePath);

  if (name.length === 0) {
    return { title: '', path: [], raw, convention: 'unknown' };
  }

  const convention = detectConvention(name, className, filePath);
  const split = splitName(name, className, convention);
  const { leaf, parameter } = extractParameter(split.leaf);
  const title = clampWithEllipsis(humanizeLeaf(leaf), MAX_TITLE_LENGTH);

  const result: HumanizedTest = parameter === undefined
    ? { title, path: split.path, raw, convention }
    : { title, path: split.path, raw, convention, parameter };
  return result;
}
