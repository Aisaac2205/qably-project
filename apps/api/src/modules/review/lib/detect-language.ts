import type { ExtractionLanguage } from '../../ai/extraction.contracts';

const EXTENSION_LANGUAGE: Record<string, ExtractionLanguage> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.java': 'java',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.go': 'go',
  '.cs': 'csharp',
};

export function detectLanguage(filePath: string): ExtractionLanguage {
  const match = /\.[^./\\]+$/.exec(filePath);

  if (match === null) return 'other';

  return EXTENSION_LANGUAGE[match[0].toLowerCase()] ?? 'other';
}
