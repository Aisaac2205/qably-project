const WHITESPACE = /\s+/gu;
const DELETE_CHARACTER = 127;
const LAST_C0_CONTROL = 31;
const TAB = 9;
const LINE_FEED = 10;
const CARRIAGE_RETURN = 13;

export const MAX_INPUT_LENGTH = 500;
export const MAX_TITLE_LENGTH = 200;
export const MAX_SUITE_NAME_LENGTH = 120;

function isControlCharacter(codePoint: number): boolean {
  if (codePoint === DELETE_CHARACTER) {
    return true;
  }
  if (codePoint > LAST_C0_CONTROL) {
    return false;
  }
  return codePoint !== TAB && codePoint !== LINE_FEED && codePoint !== CARRIAGE_RETURN;
}

function stripControlCharacters(value: string): string {
  let output = '';
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined || !isControlCharacter(codePoint)) {
      output += character;
    }
  }
  return output;
}

export function sanitize(value: string, maxLength: number = MAX_INPUT_LENGTH): string {
  const cleaned = stripControlCharacters(value.normalize('NFC')).replace(WHITESPACE, ' ').trim();
  return clampGraphemes(cleaned, maxLength);
}

export function clampGraphemes(value: string, maxLength: number): string {
  const characters = Array.from(value);
  return characters.length <= maxLength ? value : characters.slice(0, maxLength).join('');
}

export function clampWithEllipsis(value: string, maxLength: number): string {
  const characters = Array.from(value);
  if (characters.length <= maxLength) {
    return value;
  }
  return `${characters.slice(0, maxLength - 1).join('').trimEnd()}…`;
}
