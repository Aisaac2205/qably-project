export interface SeedCandidate {
  id: string;
  projectId: string;
  filePath: string;
  detectedPattern: string | null;
  evidenceId: string;
}

export interface ProposalDraft {
  projectId: string;
  evidenceId: string;
  codeChangeId: string;
  status: 'in_review';
  title: string;
  objective: string;
  preconditions: string[];
  steps: string[];
  expectedResult: string;
  priority: 'medium';
}

function toDraft(candidate: SeedCandidate): ProposalDraft {
  return {
    projectId: candidate.projectId,
    evidenceId: candidate.evidenceId,
    codeChangeId: candidate.id,
    status: 'in_review',
    title: candidate.filePath,
    objective: '',
    preconditions: [],
    steps: [],
    expectedResult: '',
    priority: 'medium',
  };
}

export function toProposalDrafts(candidates: SeedCandidate[]): ProposalDraft[] {
  return candidates
    .filter((candidate) => candidate.detectedPattern !== null)
    .map(toDraft);
}
