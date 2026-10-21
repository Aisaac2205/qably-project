export {
  DECLARATION_SNAPSHOT_VERSION,
  buildDeclarationSnapshot,
  localDeclarationId,
  readDeclarationSnapshot,
  toDeclaredFile,
  type DeclarationRef,
  type DeclarationSnapshot,
  type DeclaredFile,
  type SnapshotDeclaration,
} from './declaration-snapshot';
export {
  diffDeclarations,
  type DeclarationDiff,
  type WholeFileChange,
} from './diff-declarations';
export {
  matchTargetedCases,
  type TargetedCase,
  type TargetedMatch,
} from './match-targeted-cases';
export { readDeclaredFile } from './read-declared-file';
