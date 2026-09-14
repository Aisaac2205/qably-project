const TEMPLATE: Record<'es' | 'en', (extracted: number, declared: number) => string> = {
  es: (extracted, declared) =>
    `Aeris extrajo ${extracted} de ${declared} declaraciones de prueba encontradas en este archivo.`,
  en: (extracted, declared) =>
    `Aeris extracted ${extracted} of ${declared} test declarations found in this file.`,
};

export function incompleteExtractionNote(
  extractedCount: number,
  declarationCount: number,
  locale: 'es' | 'en',
): string {
  return TEMPLATE[locale](extractedCount, declarationCount);
}
