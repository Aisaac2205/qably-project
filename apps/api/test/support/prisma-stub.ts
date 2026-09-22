interface UpdateManyArgs {
  where?: { id?: { in?: readonly string[] } };
}

interface UpdateManyResult {
  count: number;
}

export function countingUpdateMany(): (
  args: UpdateManyArgs,
) => Promise<UpdateManyResult> {
  return jest.fn((args: UpdateManyArgs) =>
    Promise.resolve({ count: args.where?.id?.in?.length ?? 0 }),
  );
}
