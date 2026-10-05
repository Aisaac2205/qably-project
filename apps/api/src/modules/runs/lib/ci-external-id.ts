const GITHUB_RUN_ID_PREFIX = /^gha-(\d+)-/;

export function parseCiRunExternalId(
  externalId: string | null | undefined,
): string | undefined {
  if (externalId === null || externalId === undefined) return undefined;
  return GITHUB_RUN_ID_PREFIX.exec(externalId)?.[1];
}
