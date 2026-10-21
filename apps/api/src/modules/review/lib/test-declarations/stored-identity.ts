import { truncateTo } from '../../../../common/text/truncate-to';
import {
  MAX_CASE_NAME_LENGTH,
  resolveCaseIdentityKey,
} from '../../../runs/lib/case-identity';

// The classname cap of runs/lib/parse-junit-xml.ts (MAX_CLASS_NAME_LENGTH) and
// of runs.schemas.ts. The parity spec fails if they drift.
const JUNIT_CLASS_NAME_LENGTH = 250;

export interface ReportedTestcase {
  /** The `name` attribute as the reporter writes it, before XML escaping. */
  readonly name: string;
  /** The `classname` attribute as the reporter writes it. */
  readonly className: string;
}

function fitsSchema(value: string, maxLength: number): boolean {
  // zod's min/max count UTF-16 code units, after its own trim.
  return value.length >= 1 && value.length <= maxLength;
}

/**
 * The automationKey the runs side stores for one reported testcase, following
 * POST /runs/ingest/junit step by step:
 * 1. the XML parser trims attribute values, and a testcase without a name is
 *    named by its classname (`parseJunitXml`);
 * 2. the name is cut at MAX_CASE_NAME_LENGTH code points and the classname at
 *    250, and an empty classname is dropped;
 * 3. `ingestRunSchema` trims both again and rejects a value outside its
 *    min/max, which rejects the whole report group, so no key exists;
 * 4. `resolveCaseIdentityKey` composes classname and name.
 * Returns undefined when no key would be stored.
 */
export function storedIdentityKey(
  testcase: ReportedTestcase,
): string | undefined {
  const reportedClassName = testcase.className.trim();
  const reportedName = testcase.name.trim() || reportedClassName;
  if (reportedName === '') return undefined;

  const name = truncateTo(reportedName, MAX_CASE_NAME_LENGTH).trim();
  const className =
    reportedClassName === ''
      ? undefined
      : truncateTo(reportedClassName, JUNIT_CLASS_NAME_LENGTH).trim();

  if (!fitsSchema(name, MAX_CASE_NAME_LENGTH)) return undefined;
  if (
    className !== undefined &&
    !fitsSchema(className, JUNIT_CLASS_NAME_LENGTH)
  ) {
    return undefined;
  }

  return resolveCaseIdentityKey({ name, className });
}
