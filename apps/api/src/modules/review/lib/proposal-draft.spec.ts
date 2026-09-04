import { toProposalDrafts, type SeedCandidate } from './proposal-draft';

function candidate(overrides: Partial<SeedCandidate> = {}): SeedCandidate {
  return {
    id: 'change-1',
    projectId: 'project-1',
    filePath: 'src/features/cart/cart.spec.ts',
    detectedPattern: '*.spec.ts',
    evidenceId: 'evidence-1',
    ...overrides,
  };
}

describe('toProposalDrafts', () => {
  it('drafts one proposal per detected test file', () => {
    const drafts = toProposalDrafts([candidate()]);

    expect(drafts).toEqual([
      {
        projectId: 'project-1',
        evidenceId: 'evidence-1',
        codeChangeId: 'change-1',
        status: 'in_review',
        title: 'src/features/cart/cart.spec.ts',
        objective: '',
        preconditions: [],
        steps: [],
        expectedResult: '',
        priority: 'medium',
      },
    ]);
  });

  it('ignores files that matched no declared test pattern', () => {
    const drafts = toProposalDrafts([
      candidate({ id: 'change-1' }),
      candidate({
        id: 'change-2',
        filePath: 'src/features/cart/cart.ts',
        detectedPattern: null,
      }),
    ]);

    expect(drafts).toHaveLength(1);
    expect(drafts[0].codeChangeId).toBe('change-1');
  });

  it('keeps the full path as the title so two files never collide', () => {
    const drafts = toProposalDrafts([
      candidate({ id: 'change-1', filePath: 'src/cart/index.spec.ts' }),
      candidate({ id: 'change-2', filePath: 'src/checkout/index.spec.ts' }),
    ]);

    expect(drafts.map((draft) => draft.title)).toEqual([
      'src/cart/index.spec.ts',
      'src/checkout/index.spec.ts',
    ]);
  });

  it('returns nothing when no file matched a pattern', () => {
    expect(toProposalDrafts([candidate({ detectedPattern: null })])).toEqual(
      [],
    );
  });

  it('leaves the authored fields empty for a human or the model to fill', () => {
    const [draft] = toProposalDrafts([candidate()]);

    expect(draft.objective).toBe('');
    expect(draft.steps).toEqual([]);
    expect(draft.expectedResult).toBe('');
  });
});
