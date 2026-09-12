import { createHash } from 'node:crypto';

export type JobIdComponent = string | number;

const KIND_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function buildJobId(
  kind: string,
  components: readonly JobIdComponent[],
): string {
  if (!KIND_PATTERN.test(kind)) {
    throw new Error(
      `buildJobId: kind "${kind}" must match ${KIND_PATTERN.source}. ` +
        'Queue job ids are built exclusively through buildJobId so BullMQ ' +
        'never sees a raw ":" in a custom job id; keep the kind to a ' +
        'plain, static label and put every variable value in components.',
    );
  }

  const digest = createHash('sha256')
    .update(JSON.stringify(components))
    .digest('hex');

  return `${kind}-${digest}`;
}
