import { z } from 'zod';
import type {
  GroundingReference,
  GroundingReferenceKind,
  GroundingView,
} from '@qably/types';
import { MAX_GROUNDING_REFERENCES } from './chat.contracts';

export { MAX_GROUNDING_REFERENCES };

const GROUNDING_REFERENCE_KINDS = [
  'source-excerpt',
  'code-change',
  'review',
  'attached-file',
] as const satisfies readonly GroundingReferenceKind[];

export const groundingReferenceSchema = z.object({
  kind: z.enum(GROUNDING_REFERENCE_KINDS),
  id: z.string().trim().min(1).max(200),
});

export const groundingDeclarationSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('grounded'),
    references: z.array(groundingReferenceSchema).max(MAX_GROUNDING_REFERENCES),
  }),
  z.object({ status: z.literal('insufficient') }),
]);

export type GroundingDeclaration = z.infer<typeof groundingDeclarationSchema>;

export interface GroundingManifestEntry {
  kind: GroundingReferenceKind;
  id: string;
}

const ATTACHED_FILE_REFERENCE_ID = 'F1';

export function buildGroundingManifest(
  attachedCaseIds: readonly string[],
  hasAttachedFile: boolean,
): GroundingManifestEntry[] {
  const manifest: GroundingManifestEntry[] = attachedCaseIds.map((id) => ({
    kind: 'source-excerpt',
    id,
  }));

  if (hasAttachedFile) {
    manifest.push({ kind: 'attached-file', id: ATTACHED_FILE_REFERENCE_ID });
  }

  return manifest;
}

export type GroundingResolution =
  | { outcome: 'grounded'; view: GroundingView }
  | { outcome: 'insufficient'; view: GroundingView }
  | { outcome: 'fabricated'; view: GroundingView };

function isKnown(
  reference: GroundingReference,
  manifest: readonly GroundingManifestEntry[],
): boolean {
  return manifest.some(
    (entry) => entry.kind === reference.kind && entry.id === reference.id,
  );
}

export function resolveGrounding(
  declaration: GroundingDeclaration,
  manifest: readonly GroundingManifestEntry[],
): GroundingResolution {
  if (declaration.status === 'insufficient') {
    return { outcome: 'insufficient', view: { status: 'insufficient' } };
  }

  const allKnown = declaration.references.every((reference) =>
    isKnown(reference, manifest),
  );
  if (!allKnown) {
    return { outcome: 'fabricated', view: { status: 'insufficient' } };
  }

  return {
    outcome: 'grounded',
    view: { status: 'grounded', references: declaration.references },
  };
}
