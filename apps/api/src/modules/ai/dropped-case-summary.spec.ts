import { extractedCaseSchema } from './extraction.contracts';
import { summarizeDroppedCases } from './dropped-case-summary';

function issuesOf(raw: unknown) {
  const result = extractedCaseSchema.safeParse(raw);
  if (result.success) throw new Error('fixture was expected to be invalid');
  return result.error.issues;
}

function geminiCase(overrides: Record<string, unknown> = {}) {
  return {
    automationKey:
      'AiEntitlementService spendCredit returns false when AI is disabled',
    title: 'No descuenta créditos cuando la IA está deshabilitada',
    objective:
      'Verificar que spendCredit no descuente créditos si la organización tiene la IA deshabilitada',
    preconditions: ['La organización tiene aiEnabled en false'],
    steps: [
      'Configurar updateMany para que no actualice ninguna fila',
      'Llamar a spendCredit con el identificador de la organización',
    ],
    expectedResult:
      'spendCredit devuelve false y no se descuenta ningún crédito',
    priority: 'high',
    sourceExcerpt:
      'await expect(service.spendCredit(ORG_ID)).resolves.toBe(false);',
    ...overrides,
  };
}

describe('summarizeDroppedCases', () => {
  it('names the failing field and the zod issue code', () => {
    const summary = summarizeDroppedCases([
      issuesOf(geminiCase({ objective: '   ' })),
    ]);

    expect(summary).toBe('objective too_small x1');
  });

  it('aggregates per response, counting each field once per dropped case, most frequent first', () => {
    const summary = summarizeDroppedCases([
      issuesOf(geminiCase({ objective: '' })),
      issuesOf(geminiCase({ objective: '', priority: 'urgent' })),
      issuesOf(geminiCase({ steps: ['1.', '2)'] })),
    ]);

    expect(summary).toBe(
      'objective too_small x2, priority invalid_value x1, steps[] too_small x1',
    );
  });

  it('collapses array indexes so the summary names the field, not the position', () => {
    const summary = summarizeDroppedCases([
      issuesOf(geminiCase({ preconditions: ['ok', ''] })),
    ]);

    expect(summary).toBe('preconditions[] too_small x1');
  });

  it('reports a missing required field as invalid_type', () => {
    const raw: Record<string, unknown> = geminiCase();
    delete raw.expectedResult;

    expect(summarizeDroppedCases([issuesOf(raw)])).toBe(
      'expectedResult invalid_type x1',
    );
  });

  it('labels an issue on the case itself when the model emits something that is not an object', () => {
    expect(summarizeDroppedCases([issuesOf('not a case')])).toBe(
      'case invalid_type x1',
    );
  });

  it('never carries case content or source code, only field paths and codes', () => {
    const secret = 'const API_TOKEN = "sk-live-0000";';
    const summary = summarizeDroppedCases([
      issuesOf(
        geminiCase({
          title: '',
          objective: secret,
          sourceExcerpt: secret,
          priority: secret,
        }),
      ),
    ]);

    expect(summary).not.toContain('sk-live');
    expect(summary).not.toContain('API_TOKEN');
    expect(summary).toBe('priority invalid_value x1, title too_small x1');
  });
});
