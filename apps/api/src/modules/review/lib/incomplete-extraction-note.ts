const DECLARATION_TEMPLATE: Record<
  'es' | 'en',
  (extracted: number, declared: number) => string
> = {
  es: (extracted, declared) =>
    `Aeris extrajo ${extracted} de ${declared} declaraciones de prueba encontradas en este archivo.`,
  en: (extracted, declared) =>
    `Aeris extracted ${extracted} of ${declared} test declarations found in this file.`,
};

const TARGET_TEMPLATE: Record<
  'es' | 'en',
  (matched: number, total: number) => string
> = {
  es: (matched, total) =>
    `Aeris documentó ${matched} de ${total} casos solicitados en esta ejecución.`,
  en: (matched, total) =>
    `Aeris documented ${matched} of ${total} test cases requested in this run.`,
};

export function incompleteExtractionNote(
  extractedCount: number,
  declarationCount: number,
  locale: 'es' | 'en',
): string {
  return DECLARATION_TEMPLATE[locale](extractedCount, declarationCount);
}

export function incompleteTargetNote(
  matchedCount: number,
  totalTargets: number,
  locale: 'es' | 'en',
): string {
  return TARGET_TEMPLATE[locale](matchedCount, totalTargets);
}
