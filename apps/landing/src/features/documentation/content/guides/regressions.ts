import type { GuidePair } from './types';

// Placeholder: replaced by the real guide.
export const regressions: GuidePair = {
  es: {
    slug: 'regressions',
    navLabel: 'Regresiones',
    title: 'Cómo leer una regresión y sus commits candidatos',
    description: 'Cómo detecta Qably una regresión y cómo interpretar el rango de commits candidatos.',
    sections: [
      {
        id: 'regressions',
        navLabel: 'Regresiones',
        title: 'Cómo leer una regresión y sus commits candidatos',
        blocks: [
          { type: 'paragraph', text: 'Borrador.' },
          { type: 'subheading', text: 'Qué es una regresión' },
          { type: 'paragraph', text: 'Borrador.' },
          { type: 'subheading', text: 'Commits candidatos' },
          { type: 'paragraph', text: 'Borrador.' },
        ],
      },
    ],
  },
  en: {
    slug: 'regressions',
    navLabel: 'Regressions',
    title: 'How to read a regression and its candidate commits',
    description: 'How Qably detects a regression and how to interpret the candidate commit range.',
    sections: [
      {
        id: 'regressions',
        navLabel: 'Regressions',
        title: 'How to read a regression and its candidate commits',
        blocks: [
          { type: 'paragraph', text: 'Draft.' },
          { type: 'subheading', text: 'What a regression is' },
          { type: 'paragraph', text: 'Draft.' },
          { type: 'subheading', text: 'Candidate commits' },
          { type: 'paragraph', text: 'Draft.' },
        ],
      },
    ],
  },
};
