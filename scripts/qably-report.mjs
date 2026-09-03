import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const DEFAULT_API_BASE_URL = 'https://api.qably.dev';

const XML_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeXmlEntities(value) {
  return value.replace(
    /&(amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#\d+);/g,
    (match, entity) => {
      if (entity in XML_ENTITIES) return XML_ENTITIES[entity];
      if (entity.startsWith('#x')) {
        return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      }
      if (entity.startsWith('#')) {
        return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
      }
      return match;
    },
  );
}

function parseAttributes(raw) {
  const attributes = {};
  const pattern = /([a-zA-Z_:][-\w:.]*)\s*=\s*"([^"]*)"/g;
  let match = pattern.exec(raw);
  while (match !== null) {
    attributes[match[1]] = decodeXmlEntities(match[2]);
    match = pattern.exec(raw);
  }
  return attributes;
}

function extractElements(xml, tagName) {
  const elements = [];
  const pattern = new RegExp(
    `<${tagName}\\b([^>]*?)(\\/>|>([\\s\\S]*?)<\\/${tagName}>)`,
    'g',
  );
  let match = pattern.exec(xml);
  while (match !== null) {
    elements.push({
      attributes: parseAttributes(match[1]),
      body: match[3] ?? '',
    });
    match = pattern.exec(xml);
  }
  return elements;
}

function deriveCaseStatus(caseBody) {
  if (/<failure\b/.test(caseBody) || /<error\b/.test(caseBody)) return 'fail';
  if (/<skipped\b/.test(caseBody)) return 'skip';
  return 'pass';
}

function toIsoDateTime(timestamp) {
  if (!timestamp) return undefined;
  const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/.test(timestamp);
  const candidate = hasOffset ? timestamp : `${timestamp}Z`;
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function addSeconds(isoTimestamp, seconds) {
  if (!isoTimestamp || !Number.isFinite(seconds)) return undefined;
  return new Date(new Date(isoTimestamp).getTime() + seconds * 1000).toISOString();
}

function slugify(value) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'suite';
}

function shortHash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}

function buildExternalId(suiteName, jobId, runId) {
  return `gha-${runId}-${jobId}-${slugify(suiteName)}-${shortHash(suiteName)}`;
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

function buildCases(suiteBody) {
  return extractElements(suiteBody, 'testcase').map((testcase) => ({
    name: (testcase.attributes.name ?? 'unnamed test').slice(0, 120),
    status: deriveCaseStatus(testcase.body),
  }));
}

function buildRunPayload(suite, context) {
  const { attributes, body } = suite;
  const suiteName = (attributes.name ?? 'unnamed suite').slice(0, 120);
  const cases = buildCases(body);
  if (cases.length === 0) return null;

  const startedAt = toIsoDateTime(attributes.timestamp);
  const finishedAt = addSeconds(startedAt, Number.parseFloat(attributes.time ?? ''));

  return {
    externalId: buildExternalId(suiteName, context.jobId, context.runId),
    source: 'github_actions',
    suiteName,
    name: `${context.workflowName} / ${suiteName} (#${context.runNumber})`.slice(0, 200),
    ...(startedAt ? { startedAt } : {}),
    ...(finishedAt ? { finishedAt } : {}),
    ...(context.commit.commitSha ? { commitSha: context.commit.commitSha } : {}),
    ...(context.commit.commitMessage
      ? { commitMessage: context.commit.commitMessage }
      : {}),
    ...(context.commit.commitAuthor
      ? { commitAuthor: context.commit.commitAuthor }
      : {}),
    cases,
  };
}

async function postRun(baseUrl, apiKey, payload) {
  const url = new URL('/runs/ingest', baseUrl).toString();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();

  if (response.ok) {
    console.log(`[qably-report] reported "${payload.suiteName}" -> ${response.status}`);
    return true;
  }

  if (response.status === 404) {
    console.error(
      `::warning title=Qably suite not found::"${payload.suiteName}" has no matching ` +
        'suite in the Qably project yet. The ingest endpoint never creates a suite ' +
        'implicitly; create one with this exact name in the Qably UI, then re-run this ' +
        `workflow. Raw response: ${text}`,
    );
    return false;
  }

  console.error(
    `::warning title=Qably report failed::POST /runs/ingest for "${payload.suiteName}" ` +
      `returned ${response.status}. Raw response: ${text}`,
  );
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

  const suites = extractElements(xml, 'testsuite');
  if (suites.length === 0) {
    console.log(`[qably-report] no <testsuite> elements found in ${filePath}, nothing to report.`);
    return;
  }

  const context = {
    jobId: process.env.GITHUB_JOB ?? 'job',
    runId: process.env.GITHUB_RUN_ID ?? 'local',
    runNumber: process.env.GITHUB_RUN_NUMBER ?? '0',
    workflowName: process.env.GITHUB_WORKFLOW ?? 'CI',
    commit: readCommitMetadata(),
  };

  let succeeded = 0;
  let failed = 0;

  for (const suite of suites) {
    const payload = buildRunPayload(suite, context);
    if (!payload) {
      console.log(
        `[qably-report] suite "${suite.attributes.name ?? 'unnamed'}" has no cases, skipping.`,
      );
      continue;
    }

    try {
      const ok = await postRun(baseUrl, apiKey, payload);
      if (ok) succeeded += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `::warning title=Qably report failed::network error reporting "${payload.suiteName}": ${error.message}`,
      );
    }
  }

  console.log(`[qably-report] ${succeeded} succeeded, ${failed} failed out of ${succeeded + failed} suites.`);
}

main();
