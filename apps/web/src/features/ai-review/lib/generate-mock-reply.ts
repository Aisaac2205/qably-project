const GENERATE_CASE_KEYWORDS = ['genera', 'crea un caso', 'create a case', 'test case for', 'generate a case']

export function wantsCaseGeneration(text: string): boolean {
  const lower = text.toLowerCase()
  return GENERATE_CASE_KEYWORDS.some((kw) => lower.includes(kw))
}

export function buildAssistantReply(input: {
  projectCaseCount: number
  pendingCount: number
  requestText: string
  generatedCaseName?: string
}): string {
  if (input.generatedCaseName) {
    return `I drafted a new case "${input.generatedCaseName}" and added it to the review queue as pending.`
  }
  return `This project has ${input.projectCaseCount} AI-generated case(s), ${input.pendingCount} pending review.`
}
