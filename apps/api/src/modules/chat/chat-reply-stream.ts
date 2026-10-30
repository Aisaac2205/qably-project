import { suggestedCaseSchema, type SuggestedCase } from './chat.contracts';

/**
 * Decodes the top-level "reply" string of the assistant's JSON envelope, and
 * each element of its top-level "cases" array, while the envelope is still
 * streaming, so the reply can be shown token by token and a suggested case
 * can appear as soon as the model finishes generating it, instead of all at
 * once when the whole envelope has arrived.
 *
 * It only drives the live preview: the stored reply and cases always come
 * from parsing the complete envelope once the stream ends. Malformed or
 * schema-invalid input is dropped from the preview instead of failing it,
 * because the full parse reports it anyway.
 */
export interface ChatStreamDeltaResult {
  /** The reply text this chunk completed, possibly empty. */
  replyDelta: string;
  /** Cases from the "cases" array that closed within this chunk, in order. */
  cases: Array<{ index: number; case: SuggestedCase }>;
}

export interface ReplyDeltaExtractor {
  push(chunk: string): ChatStreamDeltaResult;
}

const REPLY_KEY = 'reply';
const CASES_KEY = 'cases';
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
  /** Walking the envelope, looking for a top-level "reply" or "cases" key. */
  | 'seek'
  /** After `"reply":`, expecting the opening quote of the value. */
  | 'reply-value'
  /** Inside the reply string. */
  | 'reply-string'
  /** After `"cases":`, expecting the opening bracket of the array. */
  | 'cases-value'
  /** Inside the cases array, between elements. */
  | 'cases-array'
  /** Capturing one array element's raw text, to parse once it closes. */
  | 'case-element'
  /** Nothing left worth extracting: both reply and cases are settled. */
  | 'done';

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\n' || char === '\r' || char === '\t';
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

export function createReplyDeltaExtractor(): ReplyDeltaExtractor {
  let phase: Phase = 'seek';
  let replyDone = false;
  let casesDone = false;

  // Envelope walk: nesting depth, string state and the last top-level string,
  // which is a key when a colon follows it. Only active in 'seek'.
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

  // One case element's raw text and its own nesting/string state, independent
  // of the envelope walk above: a case's fields may contain anything,
  // including text that looks like envelope syntax.
  let elementText = '';
  let elementDepth = 0;
  let elementInString = false;
  let elementEscaped = false;
  let nextCaseIndex = 0;

  function settleIfDone(): void {
    if (replyDone && casesDone) phase = 'done';
  }

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

    if (char === ':' && depth === 1) {
      if (lastTopLevelString === REPLY_KEY && !replyDone) {
        phase = 'reply-value';
        return;
      }
      if (lastTopLevelString === CASES_KEY && !casesDone) {
        phase = 'cases-value';
        return;
      }
    }

    lastTopLevelString = null;
    if (char === '"') {
      inString = true;
      currentString = '';
    } else if (char === '{' || char === '[') {
      depth += 1;
    } else if (char === '}' || char === ']') {
      depth -= 1;
      // The envelope itself just closed: nothing further can be top-level.
      if (depth <= 0) phase = 'done';
    }
  }

  function decodeReply(char: string): string {
    if (unicodeDigits !== null) {
      unicodeDigits += char;
      if (unicodeDigits.length < UNICODE_ESCAPE_LENGTH) return '';

      const digits = unicodeDigits;
      unicodeDigits = null;
      if (!HEX_DIGITS.test(digits)) {
        replyDone = true;
        phase = 'seek';
        settleIfDone();
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
      if (decoded === undefined) {
        replyDone = true;
        phase = 'seek';
        settleIfDone();
      }
      return decoded ?? '';
    }

    if (char === '\\') {
      escaping = true;
      return '';
    }
    if (char === '"') {
      replyDone = true;
      phase = 'seek';
      settleIfDone();
      return '';
    }
    return char;
  }

  /** Feeds one char of a case element's raw text; returns the parsed, schema
   * -valid case once the element's matching closing brace is reached. */
  function feedElement(char: string): SuggestedCase | null {
    elementText += char;

    if (elementInString) {
      if (elementEscaped) {
        elementEscaped = false;
      } else if (char === '\\') {
        elementEscaped = true;
      } else if (char === '"') {
        elementInString = false;
      }
      return null;
    }

    if (char === '"') {
      elementInString = true;
      return null;
    }
    if (char === '{' || char === '[') {
      elementDepth += 1;
      return null;
    }
    if (char === '}' || char === ']') {
      elementDepth -= 1;
      if (elementDepth > 0) return null;

      phase = 'cases-array';
      let parsed: unknown;
      try {
        parsed = JSON.parse(elementText);
      } catch {
        return null;
      }
      const result = suggestedCaseSchema.safeParse(parsed);
      return result.success ? result.data : null;
    }
    return null;
  }

  return {
    push(chunk: string): ChatStreamDeltaResult {
      let decoded = '';
      const cases: Array<{ index: number; case: SuggestedCase }> = [];

      for (const char of chunk) {
        if (phase === 'done') break;

        if (phase === 'seek') {
          seek(char);
        } else if (phase === 'reply-value') {
          if (isWhitespace(char)) continue;
          if (char === '"') {
            phase = 'reply-string';
          } else {
            replyDone = true;
            phase = 'seek';
            settleIfDone();
            seek(char);
          }
        } else if (phase === 'reply-string') {
          decoded += decodeReply(char);
        } else if (phase === 'cases-value') {
          if (isWhitespace(char)) continue;
          if (char === '[') {
            phase = 'cases-array';
          } else {
            casesDone = true;
            phase = 'seek';
            settleIfDone();
            seek(char);
          }
        } else if (phase === 'cases-array') {
          if (isWhitespace(char) || char === ',') continue;
          if (char === '{') {
            elementText = '{';
            elementDepth = 1;
            elementInString = false;
            elementEscaped = false;
            phase = 'case-element';
          } else if (char === ']') {
            casesDone = true;
            phase = 'seek';
            settleIfDone();
          }
          // A non-object entry never comes from this schema; ignore it.
        } else if (phase === 'case-element') {
          const finished = feedElement(char);
          if (finished !== null) {
            cases.push({ index: nextCaseIndex, case: finished });
            nextCaseIndex += 1;
          }
        }
      }

      let text = heldSurrogate + decoded;
      heldSurrogate = '';
      const last = text.charCodeAt(text.length - 1);
      if (phase === 'reply-string' && isHighSurrogate(last)) {
        heldSurrogate = text.slice(-1);
        text = text.slice(0, -1);
      }

      return { replyDelta: text, cases };
    },
  };
}
