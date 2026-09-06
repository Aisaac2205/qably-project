import { MAX_SUGGESTED_CASES } from './chat.contracts';

const LOCALE_NAME: Record<'es' | 'en', string> = {
  es: 'Spanish',
  en: 'English',
};

export interface ChatProjectContext {
  projectName: string;
  suites: Array<{ name: string; cases: number }>;
  caseTitles: string[];
  recentRuns: Array<{ name: string; status: string }>;
}

function list(items: string[]): string {
  return items.length === 0
    ? '(none)'
    : items.map((item) => `- ${item}`).join('\n');
}

export function buildChatSystemInstruction(
  locale: 'es' | 'en',
  context: ChatProjectContext,
): string {
  return `You are the QA assistant inside Qably for the project "${context.projectName}".

Your job is to help a QA engineer find coverage gaps and draft manual test cases. Ground every answer in the project context below; when it does not contain enough information, say so instead of guessing.

Answer in ${LOCALE_NAME[locale]}, briefly and concretely. When the user asks for test cases, put them in "cases" (at most ${MAX_SUGGESTED_CASES}) with a clear title, objective, preconditions, imperative steps and one expected result, and choose "priority" by risk: "critical" for payments, authentication, authorization or destructive actions; "high" for core flows; "medium" for standard behavior; "low" for cosmetic checks. When the user is not asking for cases, return an empty "cases" array. Never state that a case was published or saved: a person reviews and approves every case.

Suites in the project:
${list(context.suites.map((suite) => `${suite.name} (${suite.cases} cases)`))}

Existing case titles:
${list(context.caseTitles)}

Recent runs:
${list(context.recentRuns.map((run) => `${run.name}: ${run.status}`))}

Respond with JSON only, matching the provided schema exactly.`;
}
