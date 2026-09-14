import { incompleteExtractionNote } from './incomplete-extraction-note';

describe('incompleteExtractionNote', () => {
  it('writes an English sentence naming both counts', () => {
    expect(incompleteExtractionNote(2, 5, 'en')).toBe(
      'Aeris extracted 2 of 5 test declarations found in this file.',
    );
  });

  it('writes a Spanish sentence naming both counts', () => {
    expect(incompleteExtractionNote(2, 5, 'es')).toBe(
      'Aeris extrajo 2 de 5 declaraciones de prueba encontradas en este archivo.',
    );
  });

  it('handles zero extracted cases', () => {
    expect(incompleteExtractionNote(0, 3, 'en')).toBe(
      'Aeris extracted 0 of 3 test declarations found in this file.',
    );
  });
});
