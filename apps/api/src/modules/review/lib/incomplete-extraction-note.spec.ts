import {
  incompleteExtractionNote,
  incompleteTargetNote,
} from './incomplete-extraction-note';

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

describe('incompleteTargetNote', () => {
  it('writes an English sentence naming matched and total targets', () => {
    expect(incompleteTargetNote(1, 2, 'en')).toBe(
      'Aeris documented 1 of 2 test cases requested in this run.',
    );
  });

  it('writes a Spanish sentence naming matched and total targets', () => {
    expect(incompleteTargetNote(1, 2, 'es')).toBe(
      'Aeris documentó 1 de 2 casos solicitados en esta ejecución.',
    );
  });

  it('never reuses the declaration-based wording', () => {
    expect(incompleteTargetNote(1, 2, 'en')).not.toContain(
      'declarations found in this file',
    );
    expect(incompleteTargetNote(1, 2, 'es')).not.toContain(
      'declaraciones de prueba encontradas',
    );
  });
});
