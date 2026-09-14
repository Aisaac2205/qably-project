import type { RepoConnectionProvider } from '@qably/types';
import { splitRepo } from '../../repository/lib/split-repo';

export interface LocateAndPersistDeps {
  locate: (input: {
    provider: RepoConnectionProvider;
    owner: string;
    repo: string;
    ref: string;
    accessToken?: string;
    automationKey: string | null;
    automationClassName: string | null;
    caseName: string;
    suiteName: string | null;
  }) => Promise<string | null>;
  decrypt: (value: string) => string;
  persist: (testCaseId: string, filePath: string) => Promise<void>;
}

export interface AutomationFileConnection {
  provider: RepoConnectionProvider;
  repo: string;
  encryptedAccessToken: string | null;
}

export interface LocateAndPersistInput {
  testCaseId: string;
  automationKey: string | null;
  automationClassName: string | null;
  caseName: string;
  suiteName: string | null;
  connection: AutomationFileConnection | null;
  ref: string;
}

export async function locateAndPersistAutomationFilePath(
  deps: LocateAndPersistDeps,
  input: LocateAndPersistInput,
): Promise<string | null> {
  if (input.connection === null) return null;

  const { owner, repo } = splitRepo(input.connection.repo);
  const accessToken =
    input.connection.encryptedAccessToken === null
      ? undefined
      : deps.decrypt(input.connection.encryptedAccessToken);

  const located = await deps.locate({
    provider: input.connection.provider,
    owner,
    repo,
    ref: input.ref,
    accessToken,
    automationKey: input.automationKey,
    automationClassName: input.automationClassName,
    caseName: input.caseName,
    suiteName: input.suiteName,
  });

  if (located === null) return null;

  await deps.persist(input.testCaseId, located);

  return located;
}
