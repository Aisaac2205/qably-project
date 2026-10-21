import { describe, expect, it } from 'vitest';
import type { DiagramBlock } from '../content/types';
import { buildDiagramLayout, describeDiagramSteps, validateDiagram } from './diagram';

// A small fixture, used only here: the real diagrams live in the content.
function diagram(overrides: Partial<DiagramBlock> = {}): DiagramBlock {
  return {
    type: 'diagram',
    title: 'From CI to Qably',
    description: 'The test report travels from your CI to the Qably API.',
    groups: [
      { id: 'ci', label: 'Your CI', tone: 'external' },
      { id: 'qably', label: 'Qably', tone: 'qably' },
    ],
    nodes: [
      { id: 'runner', label: 'Test runner', group: 'ci' },
      { id: 'report', label: 'JUnit report', detail: 'A file such as `junit.xml`', group: 'ci' },
      { id: 'ingest', label: 'Ingest API', group: 'qably' },
      { id: 'dashboard', label: 'Dashboard', group: 'qably' },
    ],
    edges: [
      { from: 'runner', to: 'report', label: 'writes' },
      { from: 'report', to: 'ingest', label: 'uploads' },
    ],
    ...overrides,
  };
}

describe('validateDiagram', () => {
  it('accepts a well-formed diagram', () => {
    expect(validateDiagram(diagram())).toEqual([]);
  });

  it('accepts a diagram without groups and without edges', () => {
    expect(
      validateDiagram({
        type: 'diagram',
        title: 'T',
        description: 'D',
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
      }),
    ).toEqual([]);
  });

  it('needs at least two nodes: one box is not a flow', () => {
    expect(validateDiagram(diagram({ groups: undefined, edges: undefined, nodes: [{ id: 'a', label: 'A' }] }))).toEqual([
      'a diagram needs at least two nodes',
    ]);
  });

  it('rejects a duplicated node id and a duplicated group id', () => {
    const problems = validateDiagram(
      diagram({
        groups: [
          { id: 'ci', label: 'Your CI' },
          { id: 'ci', label: 'Again' },
        ],
        nodes: [
          { id: 'a', label: 'A', group: 'ci' },
          { id: 'a', label: 'B', group: 'ci' },
        ],
        edges: [],
      }),
    );

    expect(problems).toContain('duplicate group id "ci"');
    expect(problems).toContain('duplicate node id "a"');
  });

  it('rejects an empty id or label', () => {
    const problems = validateDiagram(
      diagram({
        groups: [{ id: 'ci', label: ' ' }],
        nodes: [
          { id: '', label: 'A', group: 'ci' },
          { id: 'b', label: '', group: 'ci' },
        ],
        edges: [],
      }),
    );

    expect(problems).toContain('group "ci" has an empty label');
    expect(problems).toContain('a node has an empty id');
    expect(problems).toContain('node "b" has an empty label');
  });

  it('rejects a node that names an unknown group', () => {
    const problems = validateDiagram(
      diagram({
        nodes: [
          { id: 'a', label: 'A', group: 'nope' },
          { id: 'b', label: 'B' },
        ],
        edges: [],
      }),
    );

    expect(problems).toContain('node "a" uses the unknown group "nope"');
  });

  it('rejects a group that no node uses', () => {
    const problems = validateDiagram(
      diagram({
        groups: [
          { id: 'ci', label: 'Your CI' },
          { id: 'ghost', label: 'Nobody' },
        ],
        nodes: [
          { id: 'a', label: 'A', group: 'ci' },
          { id: 'b', label: 'B', group: 'ci' },
        ],
        edges: [],
      }),
    );

    expect(problems).toEqual(['group "ghost" has no nodes']);
  });

  it('rejects a lane whose nodes are not next to each other', () => {
    const problems = validateDiagram(
      diagram({
        groups: [
          { id: 'ci', label: 'Your CI' },
          { id: 'qably', label: 'Qably' },
        ],
        nodes: [
          { id: 'a', label: 'A', group: 'ci' },
          { id: 'b', label: 'B', group: 'qably' },
          { id: 'c', label: 'C', group: 'ci' },
        ],
        edges: [],
      }),
    );

    expect(problems).toEqual(['group "ci" is split: its nodes must be next to each other']);
  });

  describe('edges', () => {
    it('rejects an edge that names an unknown node, on either end', () => {
      const problems = validateDiagram(
        diagram({
          edges: [
            { from: 'runner', to: 'nowhere' },
            { from: 'ghost', to: 'report' },
          ],
        }),
      );

      expect(problems).toContain('edge "runner" -> "nowhere" uses the unknown node "nowhere"');
      expect(problems).toContain('edge "ghost" -> "report" uses the unknown node "ghost"');
    });

    it('rejects an edge from a node to itself', () => {
      expect(validateDiagram(diagram({ edges: [{ from: 'runner', to: 'runner' }] }))).toContain(
        'edge "runner" -> "runner" loops on itself',
      );
    });

    it('rejects an edge that goes back, because the flow is linear and cannot cycle', () => {
      expect(validateDiagram(diagram({ edges: [{ from: 'report', to: 'runner' }] }))).toContain(
        'edge "report" -> "runner" goes back: the flow is linear and cannot loop',
      );
    });

    it('rejects an edge that skips a step', () => {
      expect(validateDiagram(diagram({ edges: [{ from: 'runner', to: 'ingest' }] }))).toContain(
        'edge "runner" -> "ingest" skips a step: it must join "runner" to "report"',
      );
    });

    it('rejects the same edge twice', () => {
      expect(
        validateDiagram(
          diagram({
            edges: [
              { from: 'runner', to: 'report' },
              { from: 'runner', to: 'report', label: 'again' },
            ],
          }),
        ),
      ).toContain('duplicate edge "runner" -> "report"');
    });

    it('reports every problem at once, so one build fixes them all', () => {
      const problems = validateDiagram(
        diagram({
          edges: [
            { from: 'runner', to: 'nowhere' },
            { from: 'report', to: 'runner' },
          ],
        }),
      );

      expect(problems).toHaveLength(2);
    });
  });
});

describe('buildDiagramLayout', () => {
  it('groups consecutive nodes of a group into one lane, in flow order', () => {
    const layout = buildDiagramLayout(diagram());

    expect(layout.lanes.map((lane) => [lane.group?.id, lane.nodes.map((node) => node.id)])).toEqual([
      ['ci', ['runner', 'report']],
      ['qably', ['ingest', 'dashboard']],
    ]);
    expect(layout.order.map((node) => node.id)).toEqual(['runner', 'report', 'ingest', 'dashboard']);
  });

  it('puts ungrouped nodes in lanes of their own, without a group', () => {
    const layout = buildDiagramLayout(
      diagram({
        groups: [{ id: 'qably', label: 'Qably', tone: 'qably' }],
        nodes: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
          { id: 'c', label: 'C', group: 'qably' },
          { id: 'd', label: 'D' },
        ],
        edges: [],
      }),
    );

    expect(layout.lanes.map((lane) => [lane.group?.id ?? null, lane.nodes.map((node) => node.id)])).toEqual([
      [null, ['a', 'b']],
      ['qably', ['c']],
      [null, ['d']],
    ]);
  });

  it('gives a lane without a tone the external tone', () => {
    const layout = buildDiagramLayout(
      diagram({ groups: [{ id: 'ci', label: 'Your CI' }, { id: 'qably', label: 'Qably', tone: 'qably' }] }),
    );

    expect(layout.lanes.map((lane) => lane.tone)).toEqual(['external', 'qably']);
    expect(buildDiagramLayout(diagram({ groups: undefined, nodes: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], edges: [] })).lanes[0]!.tone).toBe(
      'external',
    );
  });

  it('joins every pair of consecutive nodes with a connector, carrying the label of its edge', () => {
    const layout = buildDiagramLayout(diagram());

    expect(layout.connectors).toEqual([
      { from: 'runner', to: 'report', label: 'writes' },
      { from: 'report', to: 'ingest', label: 'uploads' },
      { from: 'ingest', to: 'dashboard' },
    ]);
  });

  it('chains the nodes in order when the diagram has no edges', () => {
    const layout = buildDiagramLayout(diagram({ edges: undefined }));

    expect(layout.connectors.map((connector) => [connector.from, connector.to])).toEqual([
      ['runner', 'report'],
      ['report', 'ingest'],
      ['ingest', 'dashboard'],
    ]);
    expect(layout.connectors.every((connector) => connector.label === undefined)).toBe(true);
  });

  it('refuses an invalid diagram, naming every problem', () => {
    expect(() => buildDiagramLayout(diagram({ edges: [{ from: 'report', to: 'runner' }] }))).toThrow(
      /goes back: the flow is linear/,
    );
  });
});

describe('describeDiagramSteps', () => {
  it('lists the nodes in reading order with their lane and the connector that leaves them', () => {
    const steps = describeDiagramSteps(buildDiagramLayout(diagram()));

    expect(steps.map((step) => [step.node.id, step.lane?.label ?? null, step.next?.label ?? null])).toEqual([
      ['runner', 'Your CI', 'writes'],
      ['report', 'Your CI', 'uploads'],
      ['ingest', 'Qably', null],
      ['dashboard', 'Qably', null],
    ]);
  });

  it('gives the last step no outgoing connector', () => {
    const steps = describeDiagramSteps(buildDiagramLayout(diagram()));

    expect(steps[steps.length - 1]!.next).toBeNull();
  });
});
