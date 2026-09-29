const ELLIPSIS = String.fromCharCode(0x2026);
const WORD_BOUNDARY_MIN_RATIO = 0.8;
const WHITESPACE = /\s/;

function isHighSurrogate(charCode: number): boolean {
  return charCode >= 0xd800 && charCode <= 0xdbff;
}

function findCut(value: string, budget: number): number {
  const floor = Math.ceil(budget * WORD_BOUNDARY_MIN_RATIO);

  for (let index = budget; index >= floor; index -= 1) {
    if (WHITESPACE.test(value.charAt(index))) return index;
  }

  return isHighSurrogate(value.charCodeAt(budget - 1)) ? budget - 1 : budget;
}

export function truncateOnWordBoundary(
  value: string,
  maxLength: number,
): string {
  if (value.length <= maxLength) return value;

  const budget = maxLength - ELLIPSIS.length;
  const head = value.slice(0, findCut(value, budget)).trimEnd();

  return `${head}${ELLIPSIS}`;
}
