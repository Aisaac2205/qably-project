/**
 * Decodes the top-level "reply" string of the assistant's JSON envelope while
 * the envelope is still streaming, so the reply can be shown token by token.
 *
 * It only drives the live preview: the stored reply always comes from parsing
 * the complete envelope once the stream ends. Malformed input stops the
 * preview instead of failing, because the full parse reports it anyway.
 */
export interface ReplyDeltaExtractor {
  /** Feeds the next raw chunk and returns the reply text it completed. */
  push(chunk: string): string;
}

const REPLY_KEY = 'reply';
const UNICODE_ESCAPE_LENGTH = 4;
const HEX_DIGITS = /^[0-9a-fA-F]{4}$/;

const SIMPLE_ESCAPES: Readonly<Record<string, string>> = {
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
};

type Phase =
  /** Walking the envelope, looking for the top-level "reply" key. */
  | 'seek'
  /** After `"reply":`, expecting the opening quote of the value. */
  | 'value'
  /** Inside the reply string. */
  | 'reply'
  /** Reply closed, or the envelope cannot carry one: ignore the rest. */
  | 'done';

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\n' || char === '\r' || char === '\t';
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

export function createReplyDeltaExtractor(): ReplyDeltaExtractor {
  let phase: Phase = 'seek';

  // Envelope walk: nesting depth, string state and the last top-level string,
  // which is a key when a colon follows it.
  let depth = 0;
  let inString = false;
  let stringEscaped = false;
  let currentString = '';
  let lastTopLevelString: string | null = null;

  // Reply decoding: a pending escape, the hex digits of a \u escape, and a
  // high surrogate held back until its pair arrives.
  let escaping = false;
  let unicodeDigits: string | null = null;
  let heldSurrogate = '';

  function seek(char: string): void {
    if (inString) {
      if (stringEscaped) {
        stringEscaped = false;
        if (depth === 1) currentString += char;
      } else if (char === '\\') {
        stringEscaped = true;
        if (depth === 1) currentString += char;
      } else if (char === '"') {
        inString = false;
        if (depth === 1) lastTopLevelString = currentString;
      } else if (depth === 1) {
        currentString += char;
      }
      return;
    }

    if (isWhitespace(char)) return;

    if (char === ':' && depth === 1 && lastTopLevelString === REPLY_KEY) {
      phase = 'value';
      return;
    }

    lastTopLevelString = null;
    if (char === '"') {
      inString = true;
      currentString = '';
    } else if (char === '{' || char === '[') {
      depth += 1;
    } else if (char === '}' || char === ']') {
      depth -= 1;
    }
  }

  function decodeReply(char: string): string {
    if (unicodeDigits !== null) {
      unicodeDigits += char;
      if (unicodeDigits.length < UNICODE_ESCAPE_LENGTH) return '';

      const digits = unicodeDigits;
      unicodeDigits = null;
      if (!HEX_DIGITS.test(digits)) {
        phase = 'done';
        return '';
      }
      return String.fromCharCode(parseInt(digits, 16));
    }

    if (escaping) {
      escaping = false;
      if (char === 'u') {
        unicodeDigits = '';
        return '';
      }
      const decoded = SIMPLE_ESCAPES[char];
      if (decoded === undefined) phase = 'done';
      return decoded ?? '';
    }

    if (char === '\\') {
      escaping = true;
      return '';
    }
    if (char === '"') {
      phase = 'done';
      return '';
    }
    return char;
  }

  return {
    push(chunk: string): string {
      let decoded = '';

      for (const char of chunk) {
        if (phase === 'done') break;

        if (phase === 'seek') {
          seek(char);
        } else if (phase === 'value') {
          if (isWhitespace(char)) continue;
          phase = char === '"' ? 'reply' : 'done';
        } else {
          decoded += decodeReply(char);
        }
      }

      let text = heldSurrogate + decoded;
      heldSurrogate = '';
      const last = text.charCodeAt(text.length - 1);
      if (phase === 'reply' && isHighSurrogate(last)) {
        heldSurrogate = text.slice(-1);
        text = text.slice(0, -1);
      }
      return text;
    },
  };
}
