export function prismaAdapter(): never {
  throw new Error(
    'prismaAdapter stub was called: the e2e suite must override AUTH_INSTANCE',
  );
}
