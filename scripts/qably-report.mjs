import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { basename, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_API_BASE_URL = 'https://api.qably.dev';

const MAX_THROTTLE_RETRIES = 5;
const FALLBACK_RETRY_SECONDS = 10;
const MAX_RETRY_SECONDS = 90;
const RETRY_JITTER_MS = 250;
const MAX_RUN_NAME_LENGTH = 200;

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

export function deriveWorkspacePrefix(reportPath) {
  const override = process.env.QABLY_REPO_PATH_PREFIX;
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

function buildExternalId(filePath, jobId, runId) {
  return `gha-${runId}-${jobId}-${slugify(basename(filePath))}-${shortHash(filePath)}`;
}

function readCommitMetadata() {
  const commitSha = process.env.GITHUB_SHA;
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
    commitSha,
    commitMessage: commitMessage ? commitMessage.slice(0, 2000) : undefined,
    commitAuthor: commitAuthor ? commitAuthor.slice(0, 200) : undefined,
  };
}

function buildJunitQuery(filePath, context) {
  const name = `${context.workflowName} / ${context.jobId} (#${context.runNumber})`.slice(
    0,
    MAX_RUN_NAME_LENGTH,
  );

  return {
    externalId: buildExternalId(filePath, context.jobId, context.runId),
    source: 'github_actions',
    name,
    ...(context.commit.commitSha
      ? { commitSha: context.commit.commitSha }
      : {}),
    ...(context.commit.commitMessage
      ? { commitMessage: context.commit.commitMessage }
      : {}),
    ...(context.commit.commitAuthor
      ? { commitAuthor: context.commit.commitAuthor }
      : {}),
  };
}

function buildJunitUrl(baseUrl, query) {
  const url = new URL('/runs/ingest/junit', baseUrl);

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  return url.toString();
}

function parseAccepted(responseText) {
  try {
    const parsed = JSON.parse(responseText);
    if (!Array.isArray(parsed.runs)) return { accepted: 0, externalIds: [] };

    return {
      accepted: typeof parsed.accepted === 'number' ? parsed.accepted : parsed.runs.length,
      externalIds: parsed.runs
        .map((run) => run.externalId)
        .filter((externalId) => typeof externalId === 'string'),
    };
  } catch {
    return { accepted: 0, externalIds: [] };
  }
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function throttleWaitMs(retrySeconds, attempt) {
  const seconds =
    retrySeconds ?? Math.min(FALLBACK_RETRY_SECONDS * 2 ** attempt, MAX_RETRY_SECONDS);

  return Math.min(seconds, MAX_RETRY_SECONDS) * 1000 + RETRY_JITTER_MS;
}

async function postJunitReport(baseUrl, apiKey, xml, query) {
  const url = buildJunitUrl(baseUrl, query);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/xml',
    },
    body: xml,
  });

  const text = await response.text();

  if (response.ok) {
    const { accepted, externalIds } = parseAccepted(text);
    console.log(
      `[qably-report] reported "${query.name}" -> ${response.status} ` +
        `(${accepted} accepted: ${externalIds.join(', ')})`,
    );
    return { outcome: 'ok' };
  }

  if (response.status === 429) {
    const header = Number(response.headers.get('retry-after'));

    return {
      outcome: 'throttled',
      retrySeconds: Number.isFinite(header) && header > 0 ? header : null,
    };
  }

  console.error(
    `::warning title=Qably report failed::POST /runs/ingest/junit for "${query.name}" ` +
      `returned ${response.status}. Raw response: ${text}`,
  );
  return { outcome: 'failed' };
}

async function reportJunitFile(baseUrl, apiKey, xml, query) {
  for (let attempt = 0; attempt <= MAX_THROTTLE_RETRIES; attempt += 1) {
    const result = await postJunitReport(baseUrl, apiKey, xml, query);

    if (result.outcome !== 'throttled') return result.outcome === 'ok';

    if (attempt === MAX_THROTTLE_RETRIES) {
      console.error(
        `::warning title=Qably report failed::POST /runs/ingest/junit for "${query.name}" ` +
          `stayed rate limited after ${MAX_THROTTLE_RETRIES + 1} attempts.`,
      );
      return false;
    }

    const waitMs = throttleWaitMs(result.retrySeconds, attempt);
    console.log(
      `[qably-report] rate limited on "${query.name}", ` +
        `retrying in ${Math.round(waitMs / 1000)}s.`,
    );
    await sleep(waitMs);
  }

  return false;
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error(
      '[qably-report] usage: node scripts/qably-report.mjs <path-to-junit-xml>',
    );
    return;
  }

  const apiKey = process.env.QABLY_API_KEY;
  const baseUrl = process.env.QABLY_API_BASE_URL || DEFAULT_API_BASE_URL;

  if (!apiKey) {
    console.log('[qably-report] QABLY_API_KEY is not set, skipping report.');
    return;
  }

  let xml;
  try {
    xml = readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(
      `::warning title=Qably report failed::could not read ${filePath}: ${error.message}`,
    );
    return;
  }

  if (xml.trim() === '') {
    console.log(`[qably-report] ${filePath} is empty, nothing to report.`);
    return;
  }

  const context = {
    jobId: process.env.GITHUB_JOB ?? 'job',
    runId: process.env.GITHUB_RUN_ID ?? 'local',
    runNumber: process.env.GITHUB_RUN_NUMBER ?? '0',
    workflowName: process.env.GITHUB_WORKFLOW ?? 'CI',
    commit: readCommitMetadata(),
  };

  const prefix = deriveWorkspacePrefix(filePath);
  const query = buildJunitQuery(filePath, context);
  const body = repoRelativeFilePaths(xml, prefix);

  let ok = false;
  try {
    ok = await reportJunitFile(baseUrl, apiKey, body, query);
  } catch (error) {
    console.error(
      `::warning title=Qably report failed::network error reporting "${filePath}": ${error.message}`,
    );
  }

  console.log(
    `[qably-report] ${ok ? 1 : 0} succeeded, ${ok ? 0 : 1} failed reporting ${filePath}.`,
  );
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((error) => {
    console.error(
      `::warning title=Qably report failed::unexpected error in qably-report.mjs: ${error.message}`,
    );
    process.exitCode = 0;
  });
}
