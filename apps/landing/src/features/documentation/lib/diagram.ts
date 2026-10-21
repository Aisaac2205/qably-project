import type { DiagramBlock, DiagramGroup, DiagramNode } from '../content/types';

/**
 * Layout of a `diagram` block. A diagram is a LINEAR flow: its nodes are listed
 * in flow order, each one leads to the next, and the drawing wraps runs of
 * consecutive nodes that share a group in a lane. Linear on purpose: a flow
 * that is always read in order draws the same way in a row (md and up) and in a
 * column (phones) with no measuring and no script, and its text alternative is
 * just the ordered list of its nodes. Two parallel pipelines are two diagrams.
 *
 * `edges` only name the connector between two consecutive nodes (a label such
 * as "uploads"); every pair of consecutive nodes is connected either way.
 */

export type DiagramTone = 'external' | 'qably';

export interface DiagramLane {
  /** The group the lane draws, or null for nodes that belong to none. */
  group: DiagramGroup | null;
  tone: DiagramTone;
  nodes: DiagramNode[];
}

export interface DiagramConnector {
  from: string;
  to: string;
  label?: string;
}

export interface DiagramLayout {
  lanes: DiagramLane[];
  /** Nodes in flow order. */
  order: DiagramNode[];
  /** `connectors[i]` joins `order[i]` to `order[i + 1]`. */
  connectors: DiagramConnector[];
}

export interface DiagramStep {
  node: DiagramNode;
  lane: DiagramGroup | null;
  /** The connector that leaves this node; null for the last one. */
  next: DiagramConnector | null;
}

/** Every reason the diagram cannot be drawn; empty when it can. */
export function validateDiagram(block: DiagramBlock): string[] {
  const problems: string[] = [];
  const groups = block.groups ?? [];
  const edges = block.edges ?? [];

  if (block.nodes.length < 2) problems.push('a diagram needs at least two nodes');

  const groupIds = new Set<string>();

  for (const group of groups) {
    if (groupIds.has(group.id)) problems.push(`duplicate group id "${group.id}"`);
    groupIds.add(group.id);

    if (group.label.trim() === '') problems.push(`group "${group.id}" has an empty label`);
  }

  const nodeIndex = new Map<string, number>();

  for (const [index, node] of block.nodes.entries()) {
    if (node.id.trim() === '') problems.push('a node has an empty id');
    else if (nodeIndex.has(node.id)) problems.push(`duplicate node id "${node.id}"`);
    else nodeIndex.set(node.id, index);

    if (node.label.trim() === '') problems.push(`node "${node.id}" has an empty label`);

    if (node.group !== undefined && !groupIds.has(node.group)) {
      problems.push(`node "${node.id}" uses the unknown group "${node.group}"`);
    }
  }

  const lanesSeen = new Set<string>();
  let previousGroup: string | undefined;

  for (const node of block.nodes) {
    if (node.group !== previousGroup && node.group !== undefined && groupIds.has(node.group)) {
      if (lanesSeen.has(node.group)) {
        problems.push(`group "${node.group}" is split: its nodes must be next to each other`);
      }
      lanesSeen.add(node.group);
    }

    previousGroup = node.group;
  }

  for (const group of groups) {
    if (!block.nodes.some((node) => node.group === group.id)) problems.push(`group "${group.id}" has no nodes`);
  }

  const seenEdges = new Set<string>();

  for (const edge of edges) {
    const label = `edge "${edge.from}" -> "${edge.to}"`;
    const from = nodeIndex.get(edge.from);
    const to = nodeIndex.get(edge.to);

    if (from === undefined) problems.push(`${label} uses the unknown node "${edge.from}"`);
    if (to === undefined) problems.push(`${label} uses the unknown node "${edge.to}"`);
    if (from === undefined || to === undefined) continue;

    if (from === to) {
      problems.push(`${label} loops on itself`);
    } else if (to < from) {
      problems.push(`${label} goes back: the flow is linear and cannot loop`);
    } else if (to > from + 1) {
      problems.push(`${label} skips a step: it must join "${edge.from}" to "${block.nodes[from + 1]!.id}"`);
    } else if (seenEdges.has(`${edge.from}\n${edge.to}`)) {
      problems.push(`duplicate edge "${edge.from}" -> "${edge.to}"`);
    }

    seenEdges.add(`${edge.from}\n${edge.to}`);
  }

  return problems;
}

/** Lanes, flow order and connectors of a valid diagram; throws with every problem otherwise. */
export function buildDiagramLayout(block: DiagramBlock): DiagramLayout {
  const problems = validateDiagram(block);

  if (problems.length > 0) {
    throw new Error(`Invalid diagram "${block.title}": ${problems.join('; ')}`);
  }

  const groups = new Map((block.groups ?? []).map((group) => [group.id, group]));
  const lanes: DiagramLane[] = [];

  for (const node of block.nodes) {
    const group = node.group === undefined ? null : groups.get(node.group)!;
    const last = lanes[lanes.length - 1];

    if (last !== undefined && last.group?.id === group?.id) {
      last.nodes.push(node);
    } else {
      lanes.push({ group, tone: group?.tone ?? 'external', nodes: [node] });
    }
  }

  const labels = new Map((block.edges ?? []).map((edge) => [`${edge.from}\n${edge.to}`, edge.label]));
  const connectors: DiagramConnector[] = [];

  for (const [index, node] of block.nodes.entries()) {
    const next = block.nodes[index + 1];

    if (next === undefined) break;

    const label = labels.get(`${node.id}\n${next.id}`);

    connectors.push(label === undefined ? { from: node.id, to: next.id } : { from: node.id, to: next.id, label });
  }

  return { lanes, order: [...block.nodes], connectors };
}

/** The diagram as an ordered list, for the text alternative read in place of the drawing. */
export function describeDiagramSteps(layout: DiagramLayout): DiagramStep[] {
  const laneOf = new Map<string, DiagramGroup | null>();

  for (const lane of layout.lanes) {
    for (const node of lane.nodes) laneOf.set(node.id, lane.group);
  }

  return layout.order.map((node, index) => ({
    node,
    lane: laneOf.get(node.id) ?? null,
    next: layout.connectors[index] ?? null,
  }));
}
