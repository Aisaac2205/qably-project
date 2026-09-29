import { fitCaseTitle } from './fit-case-title';

const ELLIPSIS = String.fromCharCode(0x2026);
const TITLE_LIMIT = 120;

const SHARED_PREFIX =
  'Verifica que spendCredit no descuente créditos cuando la organización tiene la IA deshabilitada aunque todavía conserve';

const REALISTIC_SENTENCE =
  'Verifica que el carrito conserve los productos agregados cuando el proveedor rechaza el pago con tarjeta y el cliente reintenta con otro medio de pago después de actualizar la página. ';

const LONG_IDENTIFIER =
  'validatesThatTheCheckoutFlowRejectsExpiredCardsBeforeChargingTheCustomerAndRestoresTheCartWhenThePaymentProviderTimesOutTwice';

const EMOJI = String.fromCodePoint(0x1f600);
const DIGEST_SUFFIX = new RegExp(`${ELLIPSIS} \\([0-9a-f]{6}\\)$`);

function titleOfLength(length: number): string {
  return REALISTIC_SENTENCE.repeat(
    Math.ceil(length / REALISTIC_SENTENCE.length),
  ).slice(0, length);
}

function hasLoneSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }

  return false;
}

describe('fitCaseTitle', () => {
  it('returns a title that already fits unchanged', () => {
    const title = 'Agrega un producto al carrito';

    expect(fitCaseTitle(title, TITLE_LIMIT)).toBe(title);
  });

  it('shortens an over-long title to the limit, marking the cut and appending a short digest of the full title', () => {
    const title = `${SHARED_PREFIX} saldo disponible en la cuenta`;

    const result = fitCaseTitle(title, TITLE_LIMIT);

    expect(result.length).toBeLessThanOrEqual(TITLE_LIMIT);
    expect(result).toMatch(new RegExp(`${ELLIPSIS} \\([0-9a-f]{6}\\)$`));
    expect(title.startsWith(result.slice(0, result.indexOf(ELLIPSIS)))).toBe(
      true,
    );
  });

  it('is deterministic, so re-extracting the same test yields the same name', () => {
    const title = `${SHARED_PREFIX} saldo disponible en la cuenta`;

    expect(fitCaseTitle(title, TITLE_LIMIT)).toBe(
      fitCaseTitle(title, TITLE_LIMIT),
    );
  });

  it('keeps two different long titles distinct even when they only differ after the cut', () => {
    const declined = `${SHARED_PREFIX} saldo, con la tarjeta rechazada`;
    const expired = `${SHARED_PREFIX} saldo, con la tarjeta vencida`;

    const first = fitCaseTitle(declined, TITLE_LIMIT);
    const second = fitCaseTitle(expired, TITLE_LIMIT);

    expect(first).not.toBe(second);
    expect(first.slice(0, first.indexOf(ELLIPSIS))).toBe(
      second.slice(0, second.indexOf(ELLIPSIS)),
    );
  });

  describe('at the length limit', () => {
    it('returns a title of exactly 120 UTF-16 units unchanged', () => {
      const title = titleOfLength(TITLE_LIMIT);

      expect(title.length).toBe(TITLE_LIMIT);
      expect(fitCaseTitle(title, TITLE_LIMIT)).toBe(title);
    });

    it('shortens a title of 121 UTF-16 units to at most 120 and appends the digest', () => {
      const title = titleOfLength(TITLE_LIMIT + 1);

      const result = fitCaseTitle(title, TITLE_LIMIT);

      expect(title.length).toBe(TITLE_LIMIT + 1);
      expect(result).not.toBe(title);
      expect(result.length).toBeLessThanOrEqual(TITLE_LIMIT);
      expect(result).toMatch(DIGEST_SUFFIX);
    });

    it('returns a title of 119 UTF-16 units unchanged', () => {
      const title = titleOfLength(TITLE_LIMIT - 1);

      expect(fitCaseTitle(title, TITLE_LIMIT)).toBe(title);
    });
  });

  describe('without a word boundary to cut on', () => {
    it('cuts an identifier with no spaces at the budget and still stays within the limit', () => {
      const result = fitCaseTitle(LONG_IDENTIFIER, TITLE_LIMIT);

      expect(LONG_IDENTIFIER).not.toMatch(/\s/);
      expect(LONG_IDENTIFIER.length).toBeGreaterThan(TITLE_LIMIT);
      expect(result.length).toBe(TITLE_LIMIT);
      expect(result).toMatch(DIGEST_SUFFIX);
      expect(
        result.startsWith(`${LONG_IDENTIFIER.slice(0, 110)}${ELLIPSIS}`),
      ).toBe(true);
    });

    it('keeps two space-free identifiers that differ only after the cut distinct', () => {
      const first = `${LONG_IDENTIFIER}WithVisa`;
      const second = `${LONG_IDENTIFIER}WithMastercard`;

      expect(fitCaseTitle(first, TITLE_LIMIT)).not.toBe(
        fitCaseTitle(second, TITLE_LIMIT),
      );
    });
  });

  describe('with a surrogate pair at the cut point', () => {
    it('backs off one unit instead of splitting a pair that straddles the cut', () => {
      const title = `${LONG_IDENTIFIER.slice(0, 109)}${EMOJI}${LONG_IDENTIFIER.slice(109)}`;

      const result = fitCaseTitle(title, TITLE_LIMIT);

      expect(title.charCodeAt(109)).toBeGreaterThanOrEqual(0xd800);
      expect(title.charCodeAt(109)).toBeLessThanOrEqual(0xdbff);
      expect(hasLoneSurrogate(result)).toBe(false);
      expect(result.length).toBeLessThanOrEqual(TITLE_LIMIT);
      expect(result).toMatch(DIGEST_SUFFIX);
      expect(
        result.startsWith(`${LONG_IDENTIFIER.slice(0, 109)}${ELLIPSIS}`),
      ).toBe(true);
    });

    it('keeps a pair whole when it ends exactly at the budget', () => {
      const title = `${LONG_IDENTIFIER.slice(0, 108)}${EMOJI}${LONG_IDENTIFIER.slice(108)}`;

      const result = fitCaseTitle(title, TITLE_LIMIT);

      expect(hasLoneSurrogate(result)).toBe(false);
      expect(result.length).toBe(TITLE_LIMIT);
      expect(
        result.startsWith(`${LONG_IDENTIFIER.slice(0, 108)}${EMOJI}`),
      ).toBe(true);
    });

    it('never leaves a lone surrogate wherever the pair falls around the cut', () => {
      const violations: number[] = [];

      for (let offset = 90; offset <= 125; offset += 1) {
        const title = `${LONG_IDENTIFIER.slice(0, offset)}${EMOJI}${LONG_IDENTIFIER.slice(offset)}`;
        const result = fitCaseTitle(title, TITLE_LIMIT);

        if (hasLoneSurrogate(result) || result.length > TITLE_LIMIT) {
          violations.push(offset);
        }
      }

      expect(violations).toEqual([]);
    });
  });

  describe('across every length from 100 to 300 UTF-16 units', () => {
    const lengths = Array.from({ length: 201 }, (_, index) => index + 100);

    it('never exceeds 120 UTF-16 units', () => {
      const violations = lengths.filter(
        (length) =>
          fitCaseTitle(titleOfLength(length), TITLE_LIMIT).length > TITLE_LIMIT,
      );

      expect(violations).toEqual([]);
    });

    it('returns a title of 120 units or fewer unchanged', () => {
      const violations = lengths
        .filter((length) => length <= TITLE_LIMIT)
        .filter((length) => {
          const title = titleOfLength(length);
          return fitCaseTitle(title, TITLE_LIMIT) !== title;
        });

      expect(violations).toEqual([]);
    });

    it('marks every longer title with an ellipsis and a digest, keeping the kept text a prefix of the original', () => {
      const violations = lengths
        .filter((length) => length > TITLE_LIMIT)
        .filter((length) => {
          const title = titleOfLength(length);
          const result = fitCaseTitle(title, TITLE_LIMIT);
          const head = result.slice(0, result.indexOf(ELLIPSIS));

          return !DIGEST_SUFFIX.test(result) || !title.startsWith(head);
        });

      expect(violations).toEqual([]);
    });

    it('is deterministic for every length', () => {
      const violations = lengths.filter((length) => {
        const title = titleOfLength(length);
        return (
          fitCaseTitle(title, TITLE_LIMIT) !== fitCaseTitle(title, TITLE_LIMIT)
        );
      });

      expect(violations).toEqual([]);
    });
  });
});
