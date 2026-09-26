import { buildTargetManifest } from '../../ai/target-reference';
import {
  matchRound,
  type MatchableCase,
  type TargetLike,
} from './match-document-targets';

interface Target extends TargetLike {
  readonly testCaseId: string;
  readonly automationKey: string;
}

interface Case extends MatchableCase {
  readonly automationKey: string;
  readonly targetRef?: string;
}

function target(testCaseId: string, automationKey: string): Target {
  return { testCaseId, automationKey };
}

function testCase(automationKey: string, targetRef?: string): Case {
  return targetRef === undefined
    ? { automationKey }
    : { automationKey, targetRef };
}

describe('matchRound', () => {
  it('binds a tag-cited case to its target even when the key has drifted (accepted)', () => {
    const t1 = target('case-1', 'Key One');
    const t2 = target('case-2', 'Key Two');
    const t3 = target('case-3', 'Key Three');
    const manifest = buildTargetManifest([t1, t2, t3]);

    const drifted = testCase('gArBaGe key that matches nothing', 'T3');
    const { matched, unmatched } = matchRound(
      [t1, t2, t3],
      [drifted],
      manifest,
    );

    expect(matched).toEqual([{ target: t3, testCase: drifted }]);
    expect(unmatched).toEqual([t1, t2]);
  });

  it('rejects a tag when the citing case key normalizes to a DIFFERENT target and falls back to key matching', () => {
    const t1 = target('case-1', 'Key One');
    const t2 = target('case-2', 'Key Two');
    const manifest = buildTargetManifest([t1, t2]);

    const conflicted = testCase('Key   Two', 'T1');
    const { matched, unmatched } = matchRound([t1, t2], [conflicted], manifest);

    expect(matched).toEqual([{ target: t2, testCase: conflicted }]);
    expect(unmatched).toEqual([t1]);
  });

  it('accepts a tag when the case key normalizes to the SAME tagged target (no conflict)', () => {
    const t1 = target('case-1', 'Key One');
    const t2 = target('case-2', 'Key Two');
    const manifest = buildTargetManifest([t1, t2]);

    const selfConsistent = testCase('Key One', 'T1');
    const { matched, unmatched } = matchRound(
      [t1, t2],
      [selfConsistent],
      manifest,
    );

    expect(matched).toEqual([{ target: t1, testCase: selfConsistent }]);
    expect(unmatched).toEqual([t2]);
  });

  it('ignores a malformed targetRef and falls back to key matching', () => {
    const t1 = target('case-1', 'Key One');
    const manifest = buildTargetManifest([t1]);

    const malformed = testCase('Key One', 'target-1');
    const { matched, unmatched } = matchRound([t1], [malformed], manifest);

    expect(matched).toEqual([{ target: t1, testCase: malformed }]);
    expect(unmatched).toEqual([]);
  });

  it('ignores an out-of-range tag (valid grammar, absent from manifest) and falls back to key matching', () => {
    const t1 = target('case-1', 'Key One');
    const t2 = target('case-2', 'Key Two');
    const t3 = target('case-3', 'Key Three');
    const manifest = buildTargetManifest([t1, t2, t3]);

    const outOfRange = testCase('Key Two', 'T9');
    const { matched, unmatched } = matchRound(
      [t1, t2, t3],
      [outOfRange],
      manifest,
    );

    expect(matched).toEqual([{ target: t2, testCase: outOfRange }]);
    expect(unmatched).toEqual([t1, t3]);
  });

  it('rejects both cases when two distinct cases cite the identical tag, leaving the target available for key matching', () => {
    const t1 = target('case-1', 'Key One');
    const manifest = buildTargetManifest([t1]);

    const claimA = testCase('some other key A', 'T1');
    const claimB = testCase('Key One', 'T1');
    const { matched, unmatched } = matchRound([t1], [claimA, claimB], manifest);

    expect(matched).toEqual([{ target: t1, testCase: claimB }]);
    expect(unmatched).toEqual([]);
  });

  it('excludes a tag-consumed case from the key-matching pool even when its raw automationKey duplicates another case', () => {
    const t1 = target('case-1', 'Solo Key');
    const manifest = buildTargetManifest([t1]);

    // Drifted enough that it matches no target's key by itself, so the tag
    // claim is conflict-free and the case is consumed.
    const consumed = testCase('totally unrelated drifted value', 'T1');
    // Same raw automationKey as `consumed`, but with no tag of its own.
    const rawDuplicate = testCase('totally unrelated drifted value');

    const { matched, unmatched } = matchRound(
      [t1],
      [consumed, rawDuplicate],
      manifest,
    );

    expect(matched).toEqual([{ target: t1, testCase: consumed }]);
    expect(unmatched).toEqual([]);
  });

  it('rejects a tag when two targets share an identical normalized key (accepted edge case), falling both back to the same key match', () => {
    const t1 = target('case-1', 'Shared Key');
    const t2 = target('case-2', 'Shared Key');
    const manifest = buildTargetManifest([t1, t2]);

    const exactMatch = testCase('Shared Key', 'T1');
    const { matched, unmatched } = matchRound([t1, t2], [exactMatch], manifest);

    expect(matched).toEqual([
      { target: t1, testCase: exactMatch },
      { target: t2, testCase: exactMatch },
    ]);
    expect(unmatched).toEqual([]);
  });

  it('matches a fully tagless case list purely by normalized key, identical to pre-change behavior', () => {
    const t1 = target('case-1', 'Key One');
    const t2 = target('case-2', 'Key Two');
    const manifest = buildTargetManifest([t1, t2]);

    const caseForT2 = testCase('Key   Two');
    const caseForT1 = testCase('Key    One');
    const { matched, unmatched } = matchRound(
      [t1, t2],
      [caseForT2, caseForT1],
      manifest,
    );

    expect(matched).toEqual([
      { target: t1, testCase: caseForT1 },
      { target: t2, testCase: caseForT2 },
    ]);
    expect(unmatched).toEqual([]);
  });

  it('outputs matched entries in targets order, not manifest or case order', () => {
    const t1 = target('case-1', 'Alpha');
    const t2 = target('case-2', 'Beta');
    const t3 = target('case-3', 'Gamma');
    const manifest = buildTargetManifest([t1, t2, t3]);

    const caseGamma = testCase('Gamma');
    const caseAlpha = testCase('Alpha');
    const { matched } = matchRound(
      [t3, t1, t2],
      [caseGamma, caseAlpha],
      manifest,
    );

    expect(matched).toEqual([
      { target: t3, testCase: caseGamma },
      { target: t1, testCase: caseAlpha },
    ]);
  });

  it('resolves a tag match even when the targets array passed in is a different-but-equal array from the one the manifest was built from', () => {
    // Regression: matching used to key an internal map by object identity
    // against the manifest's target reference, so any caller that rebuilds
    // its targets array between building the manifest and calling
    // matchRound (a fresh query, a .map(), a retry round) would silently
    // lose every tag match with no error.
    const t1 = target('case-1', 'Key One');
    const manifest = buildTargetManifest([t1]);
    const clonedT1 = target('case-1', 'Key One');

    const drifted = testCase('gArBaGe key that matches nothing', 'T1');
    const { matched, unmatched } = matchRound([clonedT1], [drifted], manifest);

    expect(matched).toEqual([{ target: clonedT1, testCase: drifted }]);
    expect(unmatched).toEqual([]);
  });

  it('leaves a target unmatched when no case cites it by tag or key', () => {
    const t1 = target('case-1', 'Alpha');
    const t2 = target('case-2', 'Beta');
    const manifest = buildTargetManifest([t1, t2]);

    const { matched, unmatched } = matchRound(
      [t1, t2],
      [testCase('Alpha')],
      manifest,
    );

    expect(matched).toEqual([{ target: t1, testCase: testCase('Alpha') }]);
    expect(unmatched).toEqual([t2]);
  });
});
