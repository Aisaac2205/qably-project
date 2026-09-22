import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { basename, dirname, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REPORT_VERSION = '10.0.0';

const DEFAULT_API_BASE_URL = 'https://api.qably.dev';
const MAX_TESTCASES_PER_REQUEST = 10_000;
const MAX_GROUPS_PER_REQUEST = 500;
const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = 300;
const RETRY_MAX_MS = 5_000;
const RETRY_JITTER_MS = 100;
const DEFAULT_THROTTLE_WAIT_SECONDS = 3;
const MAX_DIRECTORY_DEPTH = 5;
const DEFAULT_FETCH_TIMEOUT_MS = 60_000;

function resolveFetchTimeoutMs(env) {
  const raw = env.QABLY_REPORT_TIMEOUT_MS;
  if (raw === undefined) return DEFAULT_FETCH_TIMEOUT_MS;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_FETCH_TIMEOUT_MS;
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'report';
}

function shortHash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}

function normalizeSlashes(value) {
  return value.replace(/\\/g, '/').replace(/^\.\//, '');
}

export function deriveWorkspacePrefix(reportPath, env = process.env) {
  const override = env.QABLY_REPO_PATH_PREFIX;
  if (override !== undefined) return normalizeSlashes(override).replace(/\/+$/, '');

  const normalized = normalizeSlashes(reportPath);
  const reportsDir = dirname(normalized);
  if (basename(reportsDir) !== 'reports') return '';

  const workspace = dirname(reportsDir);
  return workspace === '.' || workspace === '/' ? '' : workspace;
}

export function repoRelativeFilePaths(xml, prefix) {
  if (prefix === '') return xml;

  return xml.replace(/(<testcase\s[^>]*?\sfile=")([^"]*)(")/g, (match, open, value, close) => {
    const path = normalizeSlashes(value);
    if (path === '' || path.startsWith(`${prefix}/`)) return `${open}${path}${close}`;
    return `${open}${prefix}/${path}${close}`;
  });
}

export function countTestcases(xml) {
  const matches = xml.match(/<testcase\b/gi);
  return matches === null ? 0 : matches.length;
}

function maskCdataAndComments(xml) {
  return xml
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, (match) => ' '.repeat(match.length))
    .replace(/<!--[\s\S]*?-->/g, (match) => ' '.repeat(match.length));
}

export function findTopLevelTestsuiteBlocks(xml) {
  const masked = maskCdataAndComments(xml);
  const rootOpen = /<testsuites\b[^>]*>/i.exec(masked);
  if (rootOpen === null) return null;

  const bodyStart = rootOpen.index + rootOpen[0].length;
  const rootClose = /<\/testsuites\s*>/i.exec(masked.slice(bodyStart));
  const bodyEnd = rootClose === null ? xml.length : bodyStart + rootClose.index;
  const body = xml.slice(bodyStart, bodyEnd);
  const maskedBody = masked.slice(bodyStart, bodyEnd);

  const tagPattern = /<testsuite\b[^>]*?(\/)?>|<\/testsuite\s*>/gi;
  const blocks = [];
  let depth = 0;
  let blockStart = -1;
  let match;

  while ((match = tagPattern.exec(maskedBody)) !== null) {
    const isClose = match[0].startsWith('</');
    const isSelfClosing = !isClose && match[1] === '/';

    if (isClose) {
      if (depth > 0) depth -= 1;
      if (depth === 0 && blockStart !== -1) {
        blocks.push(body.slice(blockStart, match.index + match[0].length));
        blockStart = -1;
      }
      continue;
    }

    if (depth === 0) {
      if (isSelfClosing) {
        blocks.push(body.slice(match.index, match.index + match[0].length));
      } else {
        blockStart = match.index;
        depth += 1;
      }
    } else if (!isSelfClosing) {
      depth += 1;
    }
  }

  return {
    prefix: xml.slice(0, bodyStart),
    suffix: xml.slice(bodyEnd),
    blocks,
  };
}

const MAX_SUITE_KEY_LENGTH = 500;
const MAX_SUITE_KEY_DEPTH = 32;

function truncateToCodePoints(value, maxLength) {
  const codePoints = Array.from(value);
  return codePoints.length <= maxLength ? value : codePoints.slice(0, maxLength).join('');
}

function readOwnNameAttribute(openTag) {
  const match = /\sname\s*=\s*"([^"]*)"/.exec(openTag);
  return match === null ? '' : match[1];
}

// Splits `fragment` into its direct `<testsuite>` children (each as
// { openTag, inner, selfClosing }, respecting nesting depth) plus the text
// outside of any of those children — mirrors the depth-tracking scan in
// findTopLevelTestsuiteBlocks, generalized to work on any XML fragment, not
// only the body of a <testsuites> root.
function splitChildTestsuiteBlocks(fragment) {
  const masked = maskCdataAndComments(fragment);
  const tagPattern = /<testsuite\b[^>]*?(\/)?>|<\/testsuite\s*>/gi;
  const children = [];
  const outsideRanges = [];
  let depth = 0;
  let openInfo = null;
  let outsideStart = 0;
  let match;

  while ((match = tagPattern.exec(masked)) !== null) {
    const isClose = match[0].startsWith('</');
    const isSelfClosing = !isClose && match[1] === '/';

    if (depth === 0 && openInfo === null) {
      outsideRanges.push([outsideStart, match.index]);
    }

    if (isClose) {
      if (depth > 0) depth -= 1;
      if (depth === 0 && openInfo !== null) {
        children.push({
          openTag: openInfo.tag,
          inner: fragment.slice(openInfo.innerStart, match.index),
          selfClosing: false,
        });
        openInfo = null;
        outsideStart = match.index + match[0].length;
      }
      continue;
    }

    if (depth === 0) {
      if (isSelfClosing) {
        children.push({ openTag: match[0], inner: '', selfClosing: true });
        outsideStart = match.index + match[0].length;
      } else {
        openInfo = { tag: match[0], innerStart: match.index + match[0].length };
        depth += 1;
      }
    } else if (!isSelfClosing) {
      depth += 1;
    }
  }

  if (openInfo === null) outsideRanges.push([outsideStart, fragment.length]);

  const outsideText = outsideRanges.map(([start, end]) => fragment.slice(start, end)).join('');

  return { children, outsideText };
}

// Ports the server's own grouping rule (parse-junit-xml.ts's collectCases,
// group-junit-report.ts's groupJunitReportBySuite) into this zero-dependency
// script: a <testsuite> with its own `name` attribute starts a new suite
// key; one without inherits its closest ancestor's key. Two nodes anywhere
// in the document that resolve to the identical suite key merge into one
// group, in first-seen order — exactly like the server's suiteKey Map.
function collectGroupSuiteKeys(openTag, inner, parentSuiteKey, depth, seen, order) {
  if (depth > MAX_SUITE_KEY_DEPTH) return;

  const ownName = readOwnNameAttribute(openTag);
  const suiteKey =
    ownName === '' ? parentSuiteKey : truncateToCodePoints(ownName, MAX_SUITE_KEY_LENGTH);

  const { children, outsideText } = splitChildTestsuiteBlocks(inner);
  const hasDirectTestcase = /<testcase\b/i.test(maskCdataAndComments(outsideText));

  if (hasDirectTestcase && !seen.has(suiteKey)) {
    seen.add(suiteKey);
    order.push(suiteKey);
  }

  for (const child of children) {
    collectGroupSuiteKeys(child.openTag, child.inner, suiteKey, depth + 1, seen, order);
  }
}

export function countTopLevelGroups(xml) {
  const masked = maskCdataAndComments(xml);
  const suitesRootMatch = /<testsuites\b[^>]*>/i.exec(masked);
  let rootOpenTag;
  let rootInner;

  if (suitesRootMatch !== null) {
    rootOpenTag = suitesRootMatch[0];
    const bodyStart = suitesRootMatch.index + suitesRootMatch[0].length;
    const rootCloseMatch = /<\/testsuites\s*>/i.exec(masked.slice(bodyStart));
    const bodyEnd = rootCloseMatch === null ? xml.length : bodyStart + rootCloseMatch.index;
    rootInner = xml.slice(bodyStart, bodyEnd);
  } else {
    const { children } = splitChildTestsuiteBlocks(xml);
    if (children.length === 0) return 1;
    rootOpenTag = children[0].openTag;
    rootInner = children[0].inner;
  }

  const seen = new Set();
  const order = [];
  collectGroupSuiteKeys(rootOpenTag, rootInner, '', 1, seen, order);

  return Math.max(order.length, 1);
}

function packTestsuiteBlocks(blocks, caps) {
  const chunks = [];
  let current = [];
  let currentCases = 0;

  for (const block of blocks) {
    const cases = countTestcases(block);
    const wouldExceedCases = currentCases + cases > caps.maxTestcases;
    const wouldExceedGroups = current.length + 1 > caps.maxGroups;

    if (current.length > 0 && (wouldExceedCases || wouldExceedGroups)) {
      chunks.push(current);
      current = [];
      currentCases = 0;
    }

    current.push(block);
    currentCases += cases;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function buildSplitRequests(xml, caps = {}) {
  const maxTestcases = caps.maxTestcases ?? MAX_TESTCASES_PER_REQUEST;
  const maxGroups = caps.maxGroups ?? MAX_GROUPS_PER_REQUEST;
  const totalCases = countTestcases(xml);
  const structure = findTopLevelTestsuiteBlocks(xml);
  const groupCount = structure === null ? 1 : Math.max(structure.blocks.length, 1);
  const needsSplit = totalCases > maxTestcases || groupCount > maxGroups;

  if (!needsSplit) {
    return [{ xml, singleGroup: groupCount <= 1 }];
  }

  if (structure === null || structure.blocks.length <= 1) {
    return [{ xml, singleGroup: true, oversizedUnsplittable: true }];
  }

  const chunks = packTestsuiteBlocks(structure.blocks, { maxTestcases, maxGroups });

  return chunks.map((blockGroup) => ({
    xml: structure.prefix + blockGroup.join('') + structure.suffix,
    singleGroup: blockGroup.length <= 1,
  }));
}

export function buildRequestExternalId(baseExternalId, index, total, singleGroup) {
  if (total <= 1 || !singleGroup) return baseExternalId;
  return `${baseExternalId}-p${index + 1}`;
}

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function evaluateBaseUrlSecurity(baseUrl) {
  let parsed;

  try {
    parsed = new URL(baseUrl);
  } catch {
    return { secure: false, reason: `QABLY_API_BASE_URL is not a valid URL: ${baseUrl}` };
  }

  if (parsed.protocol === 'https:' || LOCAL_HOSTNAMES.has(parsed.hostname)) {
    return { secure: true };
  }

  return {
    secure: false,
    reason: `QABLY_API_BASE_URL (${baseUrl}) is not https and is not localhost/127.0.0.1/::1; sending the API key there is not trusted.`,
  };
}

function isGlobPattern(value) {
  return /[*?[\]]/.test(value);
}

function segmentToRegExp(segment) {
  const escaped = segment.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped.replace(/\\\*/g, '*').replace(/\*/g, '.*').replace(/\\\?/g, '?').replace(/\?/g, '.');
  return new RegExp(`^${pattern}$`, 'i');
}

async function walkGlob(currentDir, segments, results) {
  if (segments.length === 0) return;
  const [segment, ...rest] = segments;

  if (segment === '**') {
    await walkGlob(currentDir, rest, results);

    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        await walkGlob(join(currentDir, entry.name), segments, results);
      }
    }

    return;
  }

  const isLast = rest.length === 0;
  const matcher = segmentToRegExp(segment);

  let entries;
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!matcher.test(entry.name)) continue;
    const full = join(currentDir, entry.name);

    if (isLast) {
      if (entry.isFile()) results.push(full);
    } else if (entry.isDirectory()) {
      await walkGlob(full, rest, results);
    }
  }
}

async function expandGlob(pattern, cwd) {
  const normalized = pattern.replace(/\\/g, '/');
  const driveMatch = /^([a-zA-Z]:)\//.exec(normalized);
  let startDir;
  let rest;

  if (driveMatch) {
    startDir = `${driveMatch[1]}\\`;
    rest = normalized.slice(driveMatch[0].length);
  } else if (normalized.startsWith('/')) {
    startDir = '/';
    rest = normalized.slice(1);
  } else {
    startDir = cwd;
    rest = normalized;
  }

  const segments = rest.split('/').filter((segment) => segment.length > 0);
  const results = [];
  await walkGlob(startDir, segments, results);
  return results.sort();
}

async function collectXmlFilesRecursive(dirPath, depth, visitedRealPaths) {
  if (depth > MAX_DIRECTORY_DEPTH) return [];

  let realDirPath;

  try {
    realDirPath = await realpath(dirPath);
  } catch {
    return [];
  }

  if (visitedRealPaths.has(realDirPath)) return [];
  visitedRealPaths.add(realDirPath);

  let entries;

  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = [];

  for (const entry of entries) {
    const entryPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      files.push(
        ...(await collectXmlFilesRecursive(entryPath, depth + 1, visitedRealPaths)),
      );
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) {
      files.push(entryPath);
    }
  }

  return files;
}

async function resolveOneArg(arg, cwd) {
  if (isGlobPattern(arg)) {
    return await expandGlob(arg, cwd);
  }

  const fullPath = isAbsolute(arg) ? arg : join(cwd, arg);
  let stats;

  try {
    stats = await stat(fullPath);
  } catch {
    return [fullPath];
  }

  if (stats.isDirectory()) {
    const files = await collectXmlFilesRecursive(fullPath, 1, new Set());
    return files.sort();
  }

  return [fullPath];
}

export async function resolveInputPaths(args, cwd = process.cwd()) {
  const files = [];
  const emptyArgs = [];

  for (const arg of args) {
    const matched = await resolveOneArg(arg, cwd);

    if (matched.length === 0) {
      emptyArgs.push(arg);
    } else {
      files.push(...matched);
    }
  }

  return { files: [...new Set(files)], emptyArgs };
}

export function buildFileExternalId(filePath, context) {
  return `gha-${context.runId}-${context.jobId}-${slugify(basename(filePath))}-${shortHash(filePath)}`;
}

function readCommitMetadata(env) {
  let commitMessage;
  let commitAuthor;

  try {
    commitMessage = execFileSync('git', ['log', '-1', '--pretty=%s'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    commitMessage = undefined;
  }

  try {
    commitAuthor = execFileSync('git', ['log', '-1', '--pretty=%an'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    commitAuthor = undefined;
  }

  return {
    commitSha: env.GITHUB_SHA,
    commitMessage: commitMessage ? commitMessage.slice(0, 2000) : undefined,
    commitAuthor: commitAuthor ? commitAuthor.slice(0, 200) : undefined,
  };
}

export function buildContext(env = process.env) {
  return {
    jobId: env.GITHUB_JOB ?? 'job',
    runId: env.GITHUB_RUN_ID ?? 'local',
    source: env.GITHUB_ACTIONS === 'true' ? 'github_actions' : 'api',
    commit: readCommitMetadata(env),
  };
}

export function buildIngestUrl(baseUrl, params) {
  const url = new URL('/runs/ingest/junit', baseUrl);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, value);
  }

  return url;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function backoffMs(attempt) {
  return Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS) + Math.floor(Math.random() * RETRY_JITTER_MS);
}

function throttleWaitMs(retryAfterHeader, attempt) {
  const seconds = Number(retryAfterHeader);
  if (retryAfterHeader !== null && Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  return Math.min(DEFAULT_THROTTLE_WAIT_SECONDS * 2 ** attempt * 1000, RETRY_MAX_MS);
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function safeText(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

export async function postJunitChunk({
  url,
  apiKey,
  xml,
  fetchImpl = fetch,
  sleepImpl = sleep,
  maxAttempts = MAX_ATTEMPTS,
  env = process.env,
}) {
  let lastOutcome = { ok: false, retryable: true, reason: 'no attempts made' };
  const timeoutMs = resolveFetchTimeoutMs(env);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    let response;

    try {
      response = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/xml',
        },
        body: xml,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      lastOutcome = {
        ok: false,
        retryable: true,
        reason: `network error: ${error.message}`,
      };

      if (attempt < maxAttempts - 1) {
        await sleepImpl(backoffMs(attempt));
        continue;
      }

      return lastOutcome;
    }

    if (response.ok) {
      return { ok: true, status: response.status, body: await safeJson(response) };
    }

    if (response.status === 429) {
      lastOutcome = { ok: false, retryable: true, reason: 'rate limited (429)' };

      if (attempt < maxAttempts - 1) {
        await sleepImpl(throttleWaitMs(response.headers.get('retry-after'), attempt));
        continue;
      }

      return lastOutcome;
    }

    if (response.status >= 500) {
      lastOutcome = {
        ok: false,
        retryable: true,
        reason: `server error (${response.status})`,
      };

      if (attempt < maxAttempts - 1) {
        await sleepImpl(backoffMs(attempt));
        continue;
      }

      return lastOutcome;
    }

    const text = await safeText(response);
    return {
      ok: false,
      retryable: false,
      status: response.status,
      reason: `rejected (${response.status}): ${text}`,
    };
  }

  return lastOutcome;
}

function isGithubActions(env) {
  return env.GITHUB_ACTIONS === 'true';
}

export function annotate(level, title, message, env = process.env) {
  if (isGithubActions(env)) {
    const prefix = level === 'error' ? '::error' : level === 'warning' ? '::warning' : '::notice';
    console.log(`${prefix} title=${title}::${message}`);
    return;
  }

  const label = level === 'error' ? '[error]' : level === 'warning' ? '[warning]' : '[notice]';
  console.log(`${label} ${title}: ${message}`);
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const args = argv.filter((value) => !value.startsWith('-'));

  if (args.length === 0) {
    annotate('warning', 'Qably report', 'no report paths given, nothing to report.', env);
    return { exitCode: 0, runs: 0, cases: 0 };
  }

  const apiKey = env.QABLY_API_KEY;
  const baseUrl = env.QABLY_API_BASE_URL || DEFAULT_API_BASE_URL;
  const failOnError = env.QABLY_FAIL_ON_ERROR === 'true';

  if (!apiKey) {
    annotate('warning', 'Qably report', 'QABLY_API_KEY is not set, skipping report.', env);
    return { exitCode: failOnError ? 1 : 0, runs: 0, cases: 0 };
  }

  const baseUrlSecurity = evaluateBaseUrlSecurity(baseUrl);

  if (!baseUrlSecurity.secure) {
    if (failOnError) {
      annotate(
        'error',
        'Qably report',
        `${baseUrlSecurity.reason} Refusing to send QABLY_API_KEY because QABLY_FAIL_ON_ERROR=true.`,
        env,
      );
      return { exitCode: 1, runs: 0, cases: 0 };
    }

    annotate('warning', 'Qably report', baseUrlSecurity.reason, env);
  }

  const { files, emptyArgs } = await resolveInputPaths(args);
  let hadFailure = false;

  for (const arg of emptyArgs) {
    annotate('warning', 'Qably report', `${arg} matched no report files.`, env);
    hadFailure = true;
  }

  if (files.length === 0) {
    annotate('warning', 'Qably report', 'no report files matched the given paths.', env);
    return { exitCode: failOnError ? 1 : 0, runs: 0, cases: 0 };
  }

  const context = buildContext(env);
  let totalRuns = 0;
  let totalCases = 0;

  for (const filePath of files) {
    let xml;

    try {
      xml = await readFile(filePath, 'utf8');
    } catch (error) {
      annotate('warning', 'Qably report', `could not read ${filePath}: ${error.message}`, env);
      hadFailure = true;
      continue;
    }

    if (xml.trim() === '') {
      annotate('notice', 'Qably report', `${filePath} is empty, nothing to report.`, env);
      continue;
    }

    const prefix = deriveWorkspacePrefix(filePath, env);
    const body = repoRelativeFilePaths(xml, prefix);
    const baseExternalId = buildFileExternalId(filePath, context);
    const requests = buildSplitRequests(body);
    const totalGroups = countTopLevelGroups(body);

    if (requests.length > 1) {
      annotate(
        'notice',
        'Qably report',
        `${filePath} exceeds ingestion limits, splitting into ${requests.length} requests.`,
        env,
      );
    }

    for (let index = 0; index < requests.length; index += 1) {
      const request = requests[index];
      const label = requests.length > 1 ? `${filePath} (part ${index + 1}/${requests.length})` : filePath;

      if (request.oversizedUnsplittable === true) {
        annotate(
          'warning',
          'Qably report',
          `${label} exceeds ingestion limits and has no <testsuite> boundary to split on; sending as-is.`,
          env,
        );
      }

      const externalId = buildRequestExternalId(baseExternalId, index, requests.length, request.singleGroup);
      const url = buildIngestUrl(baseUrl, {
        externalId,
        source: context.source,
        commitSha: context.commit.commitSha,
        commitMessage: context.commit.commitMessage,
        commitAuthor: context.commit.commitAuthor,
        reportSize: String(totalGroups),
      });

      const outcome = await postJunitChunk({
        url,
        apiKey,
        xml: request.xml,
        env,
      });

      if (!outcome.ok) {
        annotate('warning', 'Qably report failed', `${label}: ${outcome.reason}`, env);
        hadFailure = true;
        continue;
      }

      const runs = typeof outcome.body?.accepted === 'number' ? outcome.body.accepted : (outcome.body?.runs?.length ?? 0);
      const cases = countTestcases(request.xml);
      totalRuns += runs;
      totalCases += cases;
      annotate('notice', 'Qably report', `${label}: ${runs} runs, ${cases} cases`, env);

      const rejected = Array.isArray(outcome.body?.rejected) ? outcome.body.rejected : [];
      for (const group of rejected) {
        annotate(
          'warning',
          'Qably report rejected a group',
          `${label}: ${group.suiteName}: ${group.reason}`,
          env,
        );
        hadFailure = true;
      }

      const collisions = Array.isArray(outcome.body?.caseIdentityCollisions)
        ? outcome.body.caseIdentityCollisions
        : [];
      for (const collision of collisions) {
        annotate(
          'warning',
          'Qably report found a case identity collision',
          `${label}: ${collision.suiteName}: "${collision.key}" matches ${collision.count} different cases; rename them so they stop colliding.`,
          env,
        );
        hadFailure = true;
      }

      const truncatedFields =
        outcome.body?.truncatedFields && typeof outcome.body.truncatedFields === 'object'
          ? Object.entries(outcome.body.truncatedFields)
          : [];
      if (truncatedFields.length > 0) {
        const summary = truncatedFields.map(([field, count]) => `${field}: ${count}`).join(', ');
        annotate('notice', 'Qably report truncated fields', `${label}: ${summary}`, env);
      }
    }
  }

  annotate(
    'notice',
    'Qably report summary',
    `${totalRuns} runs, ${totalCases} cases reported across ${files.length} file(s).`,
    env,
  );

  return { exitCode: hadFailure && failOnError ? 1 : 0, runs: totalRuns, cases: totalCases };
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().then(
    (result) => {
      process.exitCode = result.exitCode;
    },
    (error) => {
      annotate(
        'warning',
        'Qably report failed',
        `unexpected error in qably-report.mjs: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = process.env.QABLY_FAIL_ON_ERROR === 'true' ? 1 : 0;
    },
  );
}
