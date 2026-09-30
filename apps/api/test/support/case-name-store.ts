import { testCaseNameViolation } from './prisma-unique-violation';

export interface StoredCase {
  id: string;
  suiteId: string;
  name: string;
  automationKey?: string | null;
  fields?: Record<string, unknown>;
}

export interface StoredVersion {
  testCaseId: string;
  version: number;
  title: string;
}

export interface StoreState {
  cases: StoredCase[];
  versions: StoredVersion[];
  creditsUsed: number;
}

interface UpdateArgs {
  where: { id: string };
  data: Record<string, unknown>;
}

interface FindFirstArgs {
  where: { suiteId: string; name: string };
}

interface CreateVersionArgs {
  data: { testCaseId: string; version: number; title: string };
}

const ABORTED_MESSAGE =
  'current transaction is aborted, commands ignored until end of transaction block';
const SAVEPOINT_STATEMENT =
  /^(SAVEPOINT|RELEASE SAVEPOINT|ROLLBACK TO SAVEPOINT) (\w+)$/;

function settle<T>(work: () => T): Promise<T> {
  return new Promise<T>((resolve) => {
    resolve(work());
  });
}

function cloneState(state: StoreState): StoreState {
  return {
    cases: state.cases.map((row) => ({
      ...row,
      fields: { ...(row.fields ?? {}) },
    })),
    versions: state.versions.map((version) => ({ ...version })),
    creditsUsed: state.creditsUsed,
  };
}

export function createCaseNameStore(initialCases: readonly StoredCase[]) {
  let committed: StoreState = cloneState({
    cases: [...initialCases],
    versions: [],
    creditsUsed: 0,
  });
  let working: StoreState = cloneState(committed);
  let aborted = false;
  const savepoints = new Map<string, StoreState>();
  const statements: string[] = [];
  const injected = new Map<string, unknown[]>();

  function assertLive(): void {
    if (aborted) throw new Error(ABORTED_MESSAGE);
  }

  function rowById(id: string): StoredCase {
    const row = working.cases.find((candidate) => candidate.id === id);
    if (row === undefined) throw new Error(`No record found for ${id}`);
    return row;
  }

  function runSavepointStatement(verb: string, name: string): void {
    if (verb === 'ROLLBACK TO SAVEPOINT') {
      const snapshot = savepoints.get(name);
      if (snapshot === undefined) throw new Error(`no such savepoint: ${name}`);
      working = cloneState(snapshot);
      aborted = false;
      return;
    }

    assertLive();

    if (verb === 'SAVEPOINT') {
      savepoints.set(name, cloneState(working));
      return;
    }

    if (!savepoints.delete(name)) throw new Error(`no such savepoint: ${name}`);
  }

  const tx = {
    $executeRawUnsafe: jest.fn((sql: string) =>
      settle(() => {
        statements.push(sql);
        const match = SAVEPOINT_STATEMENT.exec(sql);

        if (match === null) {
          assertLive();
        } else {
          runSavepointStatement(match[1], match[2]);
        }

        return 0;
      }),
    ),
    $queryRawUnsafe: jest.fn(() => Promise.resolve([])),
    organization: {
      findUnique: jest.fn(() =>
        settle(() => {
          assertLive();
          return {
            plan: 'gratuito',
            aiEnabled: true,
            aiCreditsUsed: working.creditsUsed,
            aiCreditsPeriodStart: new Date(),
          };
        }),
      ),
      updateMany: jest.fn(() =>
        settle(() => {
          assertLive();
          working.creditsUsed += 1;
          return { count: 1 };
        }),
      ),
    },
    testCase: {
      update: jest.fn((args: UpdateArgs) =>
        settle(() => {
          assertLive();
          const row = rowById(args.where.id);
          const failures = injected.get(row.id);

          if (failures !== undefined && failures.length > 0) {
            aborted = true;
            throw failures.shift();
          }

          const { name, ...rest } = args.data;

          if (typeof name === 'string') {
            const holder = working.cases.find(
              (candidate) =>
                candidate.suiteId === row.suiteId &&
                candidate.name === name &&
                candidate.id !== row.id,
            );

            if (holder !== undefined) {
              aborted = true;
              throw testCaseNameViolation();
            }

            row.name = name;
          }

          row.fields = { ...(row.fields ?? {}), ...rest };
          return row;
        }),
      ),
      findFirst: jest.fn((args: FindFirstArgs) =>
        settle(() => {
          assertLive();
          const holder = working.cases.find(
            (candidate) =>
              candidate.suiteId === args.where.suiteId &&
              candidate.name === args.where.name,
          );

          return holder === undefined
            ? null
            : {
                id: holder.id,
                suiteId: holder.suiteId,
                name: holder.name,
                automationKey: holder.automationKey ?? null,
              };
        }),
      ),
    },
    testCaseVersion: {
      count: jest.fn((args: { where: { testCaseId: string } }) =>
        settle(() => {
          assertLive();
          return working.versions.filter(
            (version) => version.testCaseId === args.where.testCaseId,
          ).length;
        }),
      ),
      create: jest.fn((args: CreateVersionArgs) =>
        settle(() => {
          assertLive();
          working.versions.push({
            testCaseId: args.data.testCaseId,
            version: args.data.version,
            title: args.data.title,
          });
          return {
            id: `${args.data.testCaseId}-v${args.data.version}`,
            version: args.data.version,
          };
        }),
      ),
    },
    extractedProposal: {
      deleteMany: jest.fn(() =>
        settle(() => {
          assertLive();
          return { count: 0 };
        }),
      ),
    },
  };

  async function transaction<T>(run: (client: typeof tx) => Promise<T>) {
    working = cloneState(committed);
    aborted = false;
    savepoints.clear();

    const result = await run(tx);
    committed = cloneState(working);
    return result;
  }

  return {
    tx,
    transaction,
    statements,
    committed: (): StoreState => cloneState(committed),
    failUpdatesOf: (caseId: string, ...errors: unknown[]): void => {
      injected.set(caseId, errors);
    },
  };
}

export type CaseNameStore = ReturnType<typeof createCaseNameStore>;
