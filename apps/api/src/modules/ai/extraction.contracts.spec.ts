import {
  extractedCaseObjectSchema,
  extractedCaseSchema,
  extractedSuiteSchema,
  extractionOutputSchema,
  MAX_EXTRACTED_CASES,
  type ExtractedCase,
} from './extraction.contracts';
import type { TargetTag } from './target-reference';

const ELLIPSIS = String.fromCharCode(0x2026);

type AssertEqual<T, U> = [T] extends [U]
  ? [U] extends [T]
    ? true
    : false
  : false;
// Record<string, never> extends Pick<T, K> only holds when K is an OPTIONAL
// key of T — a required key (even one typed `X | undefined`) fails this
// check. This is what guards against Zod 4's `z.unknown()` producing a
// required key on the inferred type unless the schema itself is wrapped in
// `.optional()`.
type IsOptionalKey<T, K extends keyof T> =
  Record<string, never> extends Pick<T, K> ? true : false;
// Compile-time only — the return type is what forces `tsc`/the typecheck
// push-gate to evaluate T; the runtime body never does anything meaningful.
function assertType<T extends true>(): T {
  return true as T;
}

function validCase(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    automationKey: 'CartTest > adds an item',
    title: 'Adds an item to the cart',
    objective: 'Verify the cart totals update when an item is added',
    preconditions: ['The cart is empty'],
    steps: ['Add one item to the cart', 'Read the cart total'],
    expectedResult: 'The cart total reflects the added item price',
    priority: 'medium',
    sourceExcerpt: "it('adds an item', () => { ... })",
    ...overrides,
  };
}

describe('extractedCaseSchema', () => {
  it('accepts a well-formed extracted case', () => {
    expect(extractedCaseSchema.safeParse(validCase()).success).toBe(true);
  });

  it('strips a leading ordinal from every step so the interface is the only thing that numbers them', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({
        steps: [
          '1. Add one item to the cart',
          '2) Read the cart total',
          'Compare both',
        ],
      }),
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.steps).toEqual([
      'Add one item to the cart',
      'Read the cart total',
      'Compare both',
    ]);
  });

  it('strips a leading ordinal from preconditions the same way', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({ preconditions: ['1. The cart is empty'] }),
    );

    expect(result.success && result.data.preconditions).toEqual([
      'The cart is empty',
    ]);
  });

  it('rejects a step that is nothing but an ordinal', () => {
    expect(
      extractedCaseSchema.safeParse(validCase({ steps: ['1.'] })).success,
    ).toBe(false);
  });

  it('rejects a case with zero steps', () => {
    expect(
      extractedCaseSchema.safeParse(validCase({ steps: [] })).success,
    ).toBe(false);
  });

  it('keeps the first 20 steps, in order, when the model returns more', () => {
    const steps = Array.from(
      { length: 24 },
      (_, index) => `Ejecutar la acción número ${index + 1} del flujo`,
    );

    const result = extractedCaseSchema.safeParse(validCase({ steps }));

    expect(result.success).toBe(true);
    expect(result.success && result.data.steps).toEqual(steps.slice(0, 20));
  });

  it('ignores an invalid step beyond the cap instead of dropping the case', () => {
    const steps = [
      ...Array.from({ length: 20 }, (_, index) => `Paso válido ${index + 1}`),
      '21.',
    ];

    const result = extractedCaseSchema.safeParse(validCase({ steps }));

    expect(result.success).toBe(true);
    expect(result.success && result.data.steps).toHaveLength(20);
  });

  it('shortens a title longer than 120 characters instead of dropping the case, marking the cut with a digest', () => {
    const title =
      'Verifica que spendCredit no descuente créditos cuando la organización tiene la IA deshabilitada aunque todavía conserve saldo disponible';

    const result = extractedCaseSchema.safeParse(validCase({ title }));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title.length).toBeLessThanOrEqual(120);
    expect(result.data.title).toMatch(
      new RegExp(`${ELLIPSIS} \\([0-9a-f]{6}\\)$`),
    );
  });

  it('keeps two over-long titles that only differ after the cut distinct, so approval never collides on the name', () => {
    const prefix =
      'Rechaza el pago del pedido y conserva el carrito intacto cuando la pasarela responde con un error de validación porque';
    const first = extractedCaseSchema.safeParse(
      validCase({ title: `${prefix} la tarjeta está vencida` }),
    );
    const second = extractedCaseSchema.safeParse(
      validCase({ title: `${prefix} la tarjeta fue rechazada` }),
    );

    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(first.data.title).not.toBe(second.data.title);
  });

  it('keeps a composite classname::name automationKey intact up to 372 characters, the ingestion path\'s combined limit (250 classname + "::" + 120 name)', () => {
    const longKey = `${'c'.repeat(250)}::${'n'.repeat(120)}`;
    const result = extractedCaseSchema.safeParse(
      validCase({ automationKey: longKey }),
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.automationKey).toBe(longKey);
  });

  it('truncates an automationKey longer than 372 characters instead of dropping the case', () => {
    const longKey = `${'c'.repeat(250)}::${'n'.repeat(200)}`;
    const result = extractedCaseSchema.safeParse(
      validCase({ automationKey: longKey }),
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.automationKey).toBe(
      longKey.slice(0, 372),
    );
  });

  it('truncates automationKey on code points so a surrogate pair is never split', () => {
    const emoji = String.fromCodePoint(0x1f600);
    const longKey = `${'a'.repeat(371)}${emoji}${emoji}`;
    const result = extractedCaseSchema.safeParse(
      validCase({ automationKey: longKey }),
    );

    expect(result.success).toBe(true);
    expect(
      result.success && Array.from(result.data.automationKey),
    ).toHaveLength(372);
  });

  it('keeps the first 10 preconditions when the model returns more', () => {
    const preconditions = Array.from(
      { length: 13 },
      (_, i) => `Existe el registro de prueba ${i + 1}`,
    );

    const result = extractedCaseSchema.safeParse(validCase({ preconditions }));

    expect(result.success).toBe(true);
    expect(result.success && result.data.preconditions).toEqual(
      preconditions.slice(0, 10),
    );
  });

  it('defaults preconditions to an empty array', () => {
    const rest = { ...validCase() };
    delete (rest as { preconditions?: string[] }).preconditions;
    const result = extractedCaseSchema.safeParse(rest);
    expect(result.success).toBe(true);
    expect(result.success && result.data.preconditions).toEqual([]);
  });

  it('rejects an invalid priority', () => {
    expect(
      extractedCaseSchema.safeParse(validCase({ priority: 'urgent' })).success,
    ).toBe(false);
  });

  it('rejects a title equal to the raw automationKey', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({
        automationKey: 'CartTest > adds an item',
        title: 'CartTest > adds an item',
      }),
    );

    expect(result.success).toBe(false);
  });

  it('rejects a title equal to the automationKey after trimming whitespace', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({
        automationKey: 'CartTest > adds an item',
        title: '  CartTest > adds an item  ',
      }),
    );

    expect(result.success).toBe(false);
  });

  it('rejects a title equal to the automationKey after case-insensitive normalization', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({
        automationKey: 'CartTest > adds an item',
        title: 'CARTTEST > ADDS AN ITEM',
      }),
    );

    expect(result.success).toBe(false);
  });

  it('rejects a title equal to the automationKey after collapsing internal whitespace', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({
        automationKey: 'CartTest > adds an item',
        title: 'CartTest  >   adds  an item',
      }),
    );

    expect(result.success).toBe(false);
  });

  it('accepts a title that differs from the automationKey', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({
        automationKey: 'CartTest > adds an item',
        title: 'Adds an item to the cart',
      }),
    );

    expect(result.success).toBe(true);
  });

  it('still rejects an over-long title that echoes the automationKey, comparing the title before it is shortened', () => {
    const longKey =
      'src/modules/billing/checkout/payment-gateway.service.spec.ts::PaymentGatewayService > charge > rejects the charge when the card is expired';

    const result = extractedCaseSchema.safeParse(
      validCase({ automationKey: longKey, title: longKey }),
    );

    expect(longKey.length).toBeGreaterThan(120);
    expect(result.success).toBe(false);
    expect(
      !result.success &&
        result.error.issues.map((issue) => [issue.path, issue.code]),
    ).toEqual([[['title'], 'custom']]);
  });

  it('still rejects a title that echoes an automationKey long enough to be truncated itself', () => {
    const longKey = `${'c'.repeat(250)}::${'n'.repeat(200)}`;

    const result = extractedCaseSchema.safeParse(
      validCase({ automationKey: longKey, title: longKey }),
    );

    expect(result.success).toBe(false);
  });
});

describe('ExtractedCase targetRef type', () => {
  it('is an optional key typed TargetTag | undefined (compile-time check)', () => {
    assertType<IsOptionalKey<ExtractedCase, 'targetRef'>>();
    assertType<
      AssertEqual<ExtractedCase['targetRef'], TargetTag | undefined>
    >();
  });
});

describe('extractedCaseSchema targetRef', () => {
  it('parses a case with no targetRef key at all', () => {
    const result = extractedCaseSchema.safeParse(validCase());

    expect(result.success).toBe(true);
    expect(result.success && result.data.targetRef).toBeUndefined();
  });

  it('parses a case with a valid targetRef and preserves it', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({ targetRef: 'T2' }),
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.targetRef).toBe('T2');
  });

  it('turns a malformed targetRef into undefined instead of failing the case', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({ targetRef: 'not-a-tag' }),
    );

    expect(result.success).toBe(true);
    expect(result.success && result.data.targetRef).toBeUndefined();
  });

  it('turns a wrong-type targetRef into undefined instead of failing the case', () => {
    const result = extractedCaseSchema.safeParse(validCase({ targetRef: 42 }));

    expect(result.success).toBe(true);
    expect(result.success && result.data.targetRef).toBeUndefined();
  });
});

describe('extractionOutputSchema', () => {
  it('accepts an empty cases array', () => {
    expect(extractionOutputSchema.safeParse({ cases: [] }).success).toBe(true);
  });

  it('accepts a list of valid cases', () => {
    expect(
      extractionOutputSchema.safeParse({ cases: [validCase(), validCase()] })
        .success,
    ).toBe(true);
  });

  it(`rejects more than ${MAX_EXTRACTED_CASES} cases`, () => {
    const cases = Array.from({ length: MAX_EXTRACTED_CASES + 1 }, () =>
      validCase(),
    );
    expect(extractionOutputSchema.safeParse({ cases }).success).toBe(false);
  });

  it('rejects the whole payload when one case is malformed', () => {
    const cases = [validCase(), validCase({ steps: [] })];
    expect(extractionOutputSchema.safeParse({ cases }).success).toBe(false);
  });
});

describe('extractedCaseSchema observations', () => {
  const base = {
    automationKey: 'Cart > adds an item',
    title: 'Adds an item',
    objective: 'Verify the cart accepts an item',
    steps: ['Add an item'],
    expectedResult: 'The cart holds one item',
    priority: 'medium',
    sourceExcerpt: "it('adds an item')",
  };

  it('accepts up to five short observations', () => {
    const result = extractedCaseSchema.safeParse({
      ...base,
      observations: ['No assertion on the total', 'Uses a fixed delay'],
    });
    expect(result.success).toBe(true);
  });

  it('keeps the first five observations when the model returns more', () => {
    const observations = ['a', 'b', 'c', 'd', 'e', 'f'];

    const result = extractedCaseSchema.safeParse({ ...base, observations });

    expect(result.success).toBe(true);
    expect(result.success && result.data.observations).toEqual(
      observations.slice(0, 5),
    );
  });

  it('shortens an observation longer than 200 characters instead of dropping the case', () => {
    const observation =
      'La prueba espera un tiempo fijo con setTimeout antes de verificar el total del carrito, lo que la vuelve lenta y sensible a la carga de la máquina; además repite la misma verificación que la prueba anterior sin agregar un escenario nuevo.';

    const result = extractedCaseSchema.safeParse({
      ...base,
      observations: [observation],
    });

    expect(observation.length).toBeGreaterThan(200);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.observations?.[0].length).toBeLessThanOrEqual(200);
    expect(result.data.observations?.[0].endsWith(ELLIPSIS)).toBe(true);
  });

  it('leaves observations absent when the model omits them', () => {
    const result = extractedCaseSchema.safeParse(base);

    expect(result.success).toBe(true);
    expect(result.success && result.data.observations).toBeUndefined();
  });
});

describe('extractedCaseSchema repair of over-long free text', () => {
  const LONG_TEST_BODY = [
    "it('does not spend a credit when the organization has AI disabled', async () => {",
    '  prisma.organization.updateMany.mockResolvedValue({ count: 0 });',
    '',
    '  const spent = await service.spendCredit(ORG_ID);',
    '',
    '  expect(spent).toBe(false);',
    '  expect(prisma.organization.updateMany).toHaveBeenCalledWith({',
    '    where: { id: ORG_ID, aiEnabled: true, aiCreditsUsed: { lt: 5 } },',
    '    data: { aiCreditsUsed: { increment: 1 } },',
    '  });',
    '  expect(prisma.organization.update).not.toHaveBeenCalled();',
    '  expect(prisma.aiUsageEvent.create).not.toHaveBeenCalled();',
    '  expect(logger.warn).not.toHaveBeenCalled();',
    '  expect(await service.isEntitled(ORG_ID)).toBe(false);',
    '  expect(await service.remainingCredits(ORG_ID)).toBe(5);',
    '});',
  ].join('\n');

  const LONG_OBJECTIVE =
    'Verificar que el servicio de derechos de IA no descuente créditos de la organización cuando la funcionalidad de IA está deshabilitada, aunque la organización todavía conserve saldo disponible, que la actualización se condicione a que la IA esté habilitada y a que el saldo sea mayor que cero, que no se registren advertencias en el log y que la consulta de derechos posterior informe que la organización no está habilitada para usar Aeris en ninguna de sus funcionalidades, incluidas la extracción y el chat.';

  const LONG_ITEM =
    'Configurar el mock de prisma.organization.updateMany para que resuelva con count igual a cero, simulando que ninguna fila cumple la condición de IA habilitada y saldo positivo, y dejar el mock de prisma.organization.update sin configurar para poder verificar después que el servicio nunca lo invoca durante la operación.';

  it('uses fixtures longer than the limits they exercise', () => {
    expect(LONG_TEST_BODY.length).toBeGreaterThan(600);
    expect(LONG_OBJECTIVE.length).toBeGreaterThan(500);
    expect(LONG_ITEM.length).toBeGreaterThan(300);
  });

  it('keeps a case whose literal sourceExcerpt exceeds 600 characters, truncated to fit', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({ sourceExcerpt: LONG_TEST_BODY }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.sourceExcerpt.length).toBeLessThanOrEqual(600);
    expect(result.data.sourceExcerpt.endsWith(ELLIPSIS)).toBe(true);
    expect(
      LONG_TEST_BODY.startsWith(result.data.sourceExcerpt.slice(0, -1)),
    ).toBe(true);
  });

  it('truncates objective and expectedResult to 500 characters', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({ objective: LONG_OBJECTIVE, expectedResult: LONG_OBJECTIVE }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.objective.length).toBeLessThanOrEqual(500);
    expect(result.data.expectedResult.length).toBeLessThanOrEqual(500);
  });

  it('truncates each step and precondition to 300 characters after stripping the ordinal', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({
        steps: [`1. ${LONG_ITEM}`, 'Leer el total'],
        preconditions: [LONG_ITEM],
      }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.steps[0].length).toBeLessThanOrEqual(300);
    expect(result.data.steps[0].startsWith('Configurar el mock')).toBe(true);
    expect(result.data.preconditions[0].length).toBeLessThanOrEqual(300);
  });

  it('still drops a case whose required text is empty', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({ objective: '  ' }),
    );

    expect(result.success).toBe(false);
    expect(
      !result.success &&
        result.error.issues.map((issue) => [issue.path, issue.code]),
    ).toEqual([[['objective'], 'too_small']]);
  });

  it('still drops a case whose steps are not a list', () => {
    const result = extractedCaseSchema.safeParse(
      validCase({ steps: 'Agregar un producto y leer el total' }),
    );

    expect(result.success).toBe(false);
  });
});

describe('extractedCaseObjectSchema (chat suggestions) stays strict', () => {
  const chatCase = {
    automationKey: 'Cart > adds an item',
    title: 'Adds an item',
    objective: 'Verify the cart accepts an item',
    steps: ['Add an item'],
    expectedResult: 'The cart holds one item',
    priority: 'medium',
    sourceExcerpt: "it('adds an item')",
  };

  it('rejects an over-long objective instead of repairing it', () => {
    expect(
      extractedCaseObjectSchema.safeParse({
        ...chatCase,
        objective: 'x'.repeat(501),
      }).success,
    ).toBe(false);
  });

  it('rejects an over-long title instead of repairing it', () => {
    expect(
      extractedCaseObjectSchema.safeParse({
        ...chatCase,
        title: 'x'.repeat(121),
      }).success,
    ).toBe(false);
  });

  it('rejects more than 20 steps instead of capping them', () => {
    const steps = Array.from({ length: 21 }, (_, index) => `Step ${index}`);

    expect(
      extractedCaseObjectSchema.safeParse({ ...chatCase, steps }).success,
    ).toBe(false);
  });
});

describe('extractionOutputSchema suite summary', () => {
  it('accepts an output without a suite summary', () => {
    expect(extractionOutputSchema.safeParse({ cases: [] }).success).toBe(true);
  });

  it('bounds the suite title to 80 and the description to 300 characters', () => {
    expect(
      extractionOutputSchema.safeParse({
        cases: [],
        suite: { title: 'Checkout', description: 'Covers the purchase flow' },
      }).success,
    ).toBe(true);
    expect(
      extractionOutputSchema.safeParse({
        cases: [],
        suite: { title: 'x'.repeat(81), description: 'ok' },
      }).success,
    ).toBe(false);
    expect(
      extractionOutputSchema.safeParse({
        cases: [],
        suite: { title: 'ok', description: 'x'.repeat(301) },
      }).success,
    ).toBe(false);
  });
});

describe('extractedSuiteSchema tags', () => {
  it('defaults tags to an empty array when omitted', () => {
    const result = extractedSuiteSchema.safeParse({
      title: 'Checkout',
      description: 'Covers the purchase flow',
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.tags).toEqual([]);
  });

  it('accepts up to 20 short business-language tags', () => {
    const tags = Array.from({ length: 20 }, (_, i) => `tag-${i}`);
    const result = extractedSuiteSchema.safeParse({
      title: 'Checkout',
      description: 'Covers the purchase flow',
      tags,
    });
    expect(result.success).toBe(true);
  });

  it('rejects more than 20 tags', () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
    const result = extractedSuiteSchema.safeParse({
      title: 'Checkout',
      description: 'Covers the purchase flow',
      tags,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a tag longer than 40 characters', () => {
    const result = extractedSuiteSchema.safeParse({
      title: 'Checkout',
      description: 'Covers the purchase flow',
      tags: ['x'.repeat(41)],
    });
    expect(result.success).toBe(false);
  });
});
