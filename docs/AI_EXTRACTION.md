# AI test case extraction

`apps/api/src/modules/ai` and `apps/api/src/modules/review` turn a test source file into documented, reviewable test case proposals. A human always confirms the result before it becomes an official test case — the model never publishes anything on its own.

## Provider

The extractor is Gemini through the official `@google/genai` SDK (`GoogleGenAI({ apiKey })`, `models.generateContent`). The port is `TestCaseExtractor` (`apps/api/src/modules/ai/extraction.contracts.ts`), so a different provider can be swapped in later without touching `ExtractionProcessor`.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | no | Activates `GeminiExtractor`. Without it, `AiModule` binds `DisabledExtractor`, which always returns `provider-unavailable: 'GEMINI_API_KEY not configured'` — every code change still gets a manual-review proposal, nothing is lost. |
| `GEMINI_MODEL` | no | Model id passed to `generateContent`. See `apps/api/src/config/env.ts` for the current default; override it to move to a different Gemini model without a code change. |
| `AERIS_DAILY_BUDGET` | no | Maximum provider calls per Pacific calendar day against the platform key. Unset means unmetered. See "Credits and the daily budget" below. |

## How to change the model

Set `GEMINI_MODEL` to any model id Gemini's `models.list()` reports as available for `generateContent`, and restart the API. No code change is required.

## Provider marks are staged for bring-your-own-key

`apps/web/src/components/icons/` holds marks for Claude, Gemini, OpenAI, DeepSeek and Qwen. Nothing imports them today and that is expected: the platform default is labelled Aeris everywhere, and only an organization that connects its own provider key will ever see a real model id — and the mark that belongs to it. They are staged for that surface, not leftovers. Do not remove them as unreferenced code.

`aeris-icon.tsx`, in the same folder, is the platform mark and is in use now.

## Request shape

`GeminiExtractor` (`apps/api/src/modules/ai/gemini.extractor.ts`) sends the whole file content as `contents`, wrapped by `buildFileContentTurn` in a `<<<FILE_CONTENT>>>` block that also carries the file path and language, with:

- `systemInstruction`: the extraction prompt, versioned as `EXTRACTION_PROMPT_VERSION` (`apps/api/src/modules/ai/extraction-prompt.ts`) and stored on every proposal (`ExtractedProposal.promptVersion`) for audit. It declares that block untrusted data; see `AI_PROMPT_SAFETY.md`.
- `responseMimeType: 'application/json'` and `responseJsonSchema`: forces a structured `{ cases: [...] }` reply.
- `temperature: 0.2`, `maxOutputTokens: 8192`.
- `httpOptions.timeout: 60000` and `httpOptions.retryOptions` (3 attempts, retrying `408/429/500/502/503/504`).

A `401`/`403` from the API (invalid key) is never retried and immediately resolves to `provider-unavailable: 'invalid-credentials'`.

## Limits

- Source content is capped at **60,000 characters** per file (`SourceReader`, `apps/api/src/modules/repository/source-reader.ts`); anything longer is truncated before it reaches the model.
- `SourceReader` percent-encodes owner, repo, ref and each path segment when it builds the fetch URL, and `buildBlobUrl` does the same for the human-facing `Evidence.uri` shown to reviewers — a file path or branch name containing a space, `#` or other reserved character never breaks either link.
- The model may return at most **20 cases** per file (`MAX_EXTRACTED_CASES`, `apps/api/src/modules/ai/extraction.contracts.ts`).
- Each case field is length-bounded (title ≤120, objective/expectedResult ≤500, steps 1–20 × ≤300, preconditions ≤10 × ≤300, sourceExcerpt ≤600) and validated with Zod (`extractedCaseSchema`) before it is persisted. A case that violates the schema is dropped and counted, not persisted — it never fails the rest of the batch.
- Those bounds live **only** in Zod. The JSON schema sent to the provider (`RESPONSE_JSON_SCHEMA`) names the fields, the enum and the required list, and caps only the top-level `cases` array at `MAX_EXTRACTED_CASES`. It carries no `maxLength` and no nested `minItems`/`maxItems`, because Gemini compiles the response schema into a constrained-decoding automaton and rejects one with string length limits and nested array limits as "too many states for serving" (HTTP 400; `gemini-3.1-flash-lite` reports it only as a generic `INVALID_ARGUMENT`). With the bounded schema in place every real extraction failed before the first token was generated, while the unit suite stayed green because it never calls the provider. `gemini.response-schema.spec.ts`, `chat.response-schema.spec.ts` and `gemini.suite-summary-response-schema.spec.ts` each pin the same invariant for their own response schema, so a future "tighten the schema" change on any of the three cannot silently reintroduce it; the manual integration spec is the only check that talks to the real model.
- `extractedCaseSchema` also rejects a case whose `title`, once trimmed, equals its `automationKey`: a model that falls back to echoing the reporter's runtime name as the human-facing title produces a case that `assessCaseDocumentation` (`packages/types/src/documentation-completeness.ts`) already treats as an undocumented title, so extraction now refuses to persist that shape in the first place instead of writing a "documented" case that the completeness rule would immediately flag as incomplete. `extractedCaseObjectSchema` (the same fields, without that cross-field check) is what `chat.contracts.ts`'s `suggestedCaseSchema` derives from via `.omit({ automationKey: true, sourceExcerpt: true })`, since a chat suggestion that carries no `automationKey` has nothing to compare the title against.

## Cost estimate per file

A typical test file (a few hundred lines) runs 1,000–3,000 prompt tokens once the system instruction and the 60,000-character cap are counted, plus a few hundred output tokens per extracted case. `TokenUsage` (`promptTokens`, `candidatesTokens`, `totalTokens`) comes back on every successful extraction from `usageMetadata` and is available to wire into cost dashboards later; it is not yet persisted anywhere.

**Use a paid Gemini tier for anything beyond local experimentation.** The free tier trains on submitted content — every source file sent through it would become Google training data. A paid tier keeps the source code private to the request.

## Manual-review fallback

Whenever the extractor cannot produce a usable result, `ExtractionProcessor` still creates exactly one `ExtractedProposal`:

- `title` = the file path (or, for a documented case, the case's own file).
- `objective` = the failure reason, bounded to 500 characters.
- `needsManualReview: true`.
- `status: in_review`.

The job completes normally in this case; there is no retry loop over a missing API key or a business-rule miss. A human can then document the case by hand from the review inbox. Retrying is reserved for actual infrastructure failures (a broken database call), which propagate and let BullMQ's `attempts: 3` / exponential backoff take over — see "Uncaught errors" below.

### A fallback proposal carries no steps, and cannot be published

The fallback exists to tell a reviewer that a file could not be documented automatically. It has no `steps`, no `expectedResult` and no `preconditions`, because there is nothing to put in them.

That makes it unpublishable by definition, and the API enforces it: `ReviewService.approve` returns `incomplete-proposal` (HTTP 422) for any proposal whose `steps` are empty, before any transaction opens. Without that guard, approving a fallback published an `active` official case with zero steps — documented intent with no content — which is exactly what human review is supposed to prevent. The invariant is stated on the content, not on the flag: nothing publishes an official case with no steps, whatever produced it.

`needsManualReview` is what the reviewer sees. It travels on `ExtractedProposal` through to the web client, where `review-proposal-inspector.tsx` replaces the Steps and Expected result sections with the reason the extraction gave and disables Approve, leaving Reject available. The reason arrives in `objective` as one of the processor's own codes (`extraction-failed`, `no-tests-found`, `ai-not-enabled`, `automation-key-not-found`); `manual-review-reason.ts` maps those to translated copy and falls back to showing the raw provider message when the reason is something else.

## Where a document-case job gets its file

The thesis rule the platform implements is that only test files already present in the repository trigger AI generation, so a document-case job must always name a file the repository side has actually seen. A case created by a JUnit ingest usually cannot name one: `automationFilePath` is only populated when the report carries `<testcase file="...">`, and Surefire, gtest and several other reporters omit that attribute.

`resolveAutomationFilePath` (`apps/api/src/modules/review/lib/resolve-automation-file-path.ts`) closes that gap in three steps, each cheaper and more certain than the next:

1. The reported `automationClassName` itself, when it already looks like a test file path (`apps/api/src/modules/review/lib/classname-as-file-path.ts`) — some frameworks (gtest, several Python runners) report a path there instead of a bare class name. Free: no query at all.
2. The most recent `ExtractedProposal` in the same project with the same `automationKey`, joined to its `CodeChange.filePath`. This is the strongest provenance: the key came from a file the repository webhook detected and Qably extracted.
3. Failing that, a sibling `TestCase` in the same project with the same `automationKey` that already knows its path.

Steps 2 and 3 hinge on `automationKey` being identical on the ingest side and the extraction side. That is not a coincidence — the extraction prompt requires the model to emit the reporter's runtime name byte-for-byte precisely so the two pipelines can be joined here.

The two reporters Qably supports do not agree on that name. vitest's JUnit reporter joins the describe chain and the test title with `" > "`; jest-junit on its default templates joins them with a single space. The prompt states both conventions, and when a job carries a `TARGET_CASES` block it tells the model to copy each listed key verbatim rather than derive it. The processor then matches through `normalizeAutomationKey` (`apps/api/src/modules/review/lib/normalize-automation-key.ts`), which treats the two joins and any run of whitespace as the same key while keeping case. Before that, a jest-junit key stored as `Cart adds an item` never equalled the `Cart > adds an item` the model produced, and every target of the file fell through to an `automation-key-not-found` fallback.

A case with no `automationKey` never reaches those lookups: `enqueueDocumentCase` returns `no-automation-key` (HTTP 409) before resolution is attempted, and `enqueueDocumentFiles` counts it under the skip reason of the same name. The distinction is deliberate. `no-source-file` may only be claimed after resolution actually ran and came back empty; anything else would report a cause the platform never checked.

### Locating the file in the repository tree when nothing on record knows it

When all three `resolveAutomationFilePath` steps come back empty, `enqueueDocumentCase`, `enqueueDocumentFiles` and the `document-case` processor share one more fallback before giving up: `TestFileLocator` (`apps/api/src/modules/repository/test-file-locator.ts`). It is scoring, not guessing — it never returns a path it cannot back with the file's own content:

1. List the whole repository tree once (`GET /repos/{owner}/{repo}/git/trees/{ref}?recursive=1`, GitHub only), filtered down to paths that look like test files across the frameworks the extractor already recognizes (`apps/api/src/modules/repository/lib/test-file-pattern.ts` — the same pattern set `classNameAsTestFilePath` uses, plus the C++ conventions). The tree is cached per `owner/repo@ref` for ten minutes, so a batch of misses against the same commit costs one GitHub call, not one per case.
2. Tokenize every candidate path and the case's own descriptors (`automationClassName`, case name, suite name, `automationKey`) — split on path/punctuation separators and camelCase boundaries, lowercase, drop anything shorter than three characters or generic (`test`, `spec`, `src`, `tests`, `it`, `should`) — and score each candidate by Jaccard overlap against the descriptor tokens. Take the top five candidates that score above zero.
3. Fetch each candidate's content with `SourceReader` and accept the first one that literally contains the case's title — the last `" > "` segment of `automationKey`, or the raw case name. No content match, no answer: a well-scored filename with the wrong content inside is exactly the false positive this step exists to refuse.

A path this step finds is persisted onto the case's `automationFilePath` immediately, so the search never repeats for the same case. `enqueueDocumentCase`, `enqueueDocumentFiles` and the processor each wire it through the same glue (`apps/api/src/modules/review/lib/locate-and-persist-automation-file-path.ts`), so the connection lookup, token decryption and persistence stay in one place.

When every step — the three in `resolveAutomationFilePath` and the tree locator — comes back empty, `enqueueDocumentCase` returns `no-source-file` (HTTP 409) and the processor logs and stops. The web surface treats that as an explanatory state rather than a failure: it tells the reviewer Qably has no test file on record for this case and offers manual documentation instead.

### Fallback matrix

| Situation | Applies to | `objective` reason |
|---|---|---|
| Project has no repository connection | code-change and document-case | `no-connection` |
| Organization is not entitled to AI (see below) | code-change and document-case | `ai-not-enabled` |
| `SourceReader` could not read the file | code-change and document-case | the reader's reason (e.g. `http-404`, `timeout`, `fetch-failed`) |
| Credit decrement failed after a successful model call (race with another job) | code-change and document-case | `ai-not-enabled` |
| Model reports no test declarations, and the source genuinely has none (`countTestDeclarations` agrees) | **document-case only** | `no-tests-found` |
| Model reports no test declarations, but `countTestDeclarations` found some in the source — even after one retry with the count named in the prompt | **document-case only** | `extraction-incomplete` |
| Model returns cases, but none match the target case's `automationKey` | **document-case only** | `automation-key-not-found` |
| Model call fails (invalid credentials, timeout, schema violation, empty response) | code-change and document-case | the provider's reason (e.g. `invalid-credentials`) |
| An uncaught error is thrown anywhere in the extraction path | code-change and document-case | `extraction-failed` |
| The platform's daily Aeris budget is spent | all three job kinds | `quota-exhausted` |

For a **code-change** job, "no test declarations found" and "no case for a specific key" do not apply — a code-change extraction persists whatever cases the model found, with no single case to match against. A document-case job always targets exactly one existing automated case, so any outcome that doesn't produce that case ends in the fallback instead of silently doing nothing.

### Trusting the source over the model when it reports zero

A model call answering `no-tests-found` is ambiguous: the file might genuinely have no tests, or the model might have missed them. `countTestDeclarations` (`apps/api/src/modules/ai/count-test-declarations.ts`) is a cheap, deterministic, regex-based count of test declarations per language (`it`/`test` including `.only`/`.skip`/`.each` and its template-literal form for JS/TS, `@Test`/`@ParameterizedTest`/`@RepeatedTest`/`@TestFactory`/`@TestTemplate` for Java/Kotlin, `def test_...` for pytest, `TEST`/`TEST_F`/`TEST_P` for gtest, `func Test...` for Go) — it never parses or validates code, so it cannot be fooled the way an LLM's own confidence can, but it also cannot fully replace it, which is exactly why it only ever gates a retry rather than replacing extraction itself.

`ExtractionProcessor.extractWithDeclarationRetry` runs this count once alongside the first model call. When the model says `no-tests-found` and the count is zero, the two agree and the processor keeps the plain `no-tests-found` fallback — no retry, since there's nothing to find. When the model says `no-tests-found` but the count is greater than zero, the processor retries the same file exactly once, with a sentence appended to the system instruction naming the count (`extraction-v8`, `buildSystemInstruction`'s `declarationCountHint` parameter). If the retry still comes back empty, the fallback proposal carries `extraction-incomplete` instead of `no-tests-found` — a distinct reason, because the two mean different things to a reviewer: one says "there was nothing to document," the other says "Aeris saw evidence of tests here and still could not document them, look closer."

When the retry (or the first call) returns fewer cases than the count, extraction did not fail but it likely did not finish — `ExtractionProcessor.applyIncompleteExtractionNote` appends an observation naming both numbers (`"Aeris extracted 2 of 5 test declarations found in this file."`) onto every case in that batch, using the same `observations` mechanism the model's own advisory notes use, so the discrepancy is visible on the proposal instead of silently passing as a complete extraction.

An `extraction-incomplete` fallback proposal is not a dead end in the review inbox: `ReviewProposalInspector` reads `targetOfficialTestCaseId`/`targetOfficialTestCaseSuiteId` — the review list now selects `targetTestCase.suiteId` alongside the existing `targetTestCaseId`, so the client knows which suite the case lives in without a second request — and, when both are present, offers a "Document again with Aeris" action that calls the same `POST /suites/:id/cases/:caseId/document` endpoint the case card's own "Document again with Aeris" row action uses (`enqueueDocumentCase`, above). The action is scoped to `extraction-incomplete` specifically: a plain `no-tests-found` fallback has nothing to retry.

## File-level documentation

A repository connected for the first time arrives with every automated case already created by CI and none of them documented. Asking a reviewer to press a per-case button several hundred times is not a workflow, and it bills a model call per case for work the model does per file anyway: the extractor reads a whole test file and can return up to `MAX_EXTRACTED_CASES` cases from that one call.

The `document-file` job kind is that unit. `ExtractionService.enqueueDocumentFiles` collects the automated cases in a suite or project that have no steps and no proposal already in review, groups them by resolved `automationFilePath`, and enqueues one job per file carrying the list of `automationKey`s to fill. `POST /suites/:id/document` and `POST /projects/:id/document` expose it, both behind `AiEntitlementGuard` and a throttle, and both answer with `filesEnqueued`, `casesTargeted` and a `casesSkipped` breakdown so the caller can see what was left out and why rather than assuming everything was queued.

The processor matches each returned case to a target by `automationKey`, the same join key run ingestion uses, and writes one `ExtractedProposal` per matched target. A target the model never returned gets its own `automation-key-not-found` fallback: a case that could not be documented is visible in the review inbox, never a silent omission.

Since `extraction-v9`, a `document-file` job's prompt tells the model to extract only the declarations named in its `TARGET_CASES` block and ignore every other test declaration in the file; the older "one entry per declaration" instruction — still the rule for a code-change or document-case job, which never carries a target list — no longer applies once targets are present. This removes the previous conflict between that blanket instruction and the schema's `MAX_EXTRACTED_CASES` cap on a file with more declarations than a single chunk's targets.

One request enqueues at most `MAX_DOCUMENT_FILES_PER_REQUEST` files. A first connection can bring thousands of undocumented cases across hundreds of files, and without a ceiling a single click would commit that many provider calls before anyone could see the bill. The response reports what was actually queued, and the action stays available while cases remain, so the rest is queued by pressing again — a bounded commitment repeated deliberately, rather than one unbounded one.

The job id is `document-file:<projectId>:<filePath>:<chunkIndex>`. The project id is not decoration: two organizations routinely hold a file at the same relative path, and an id built from the path alone would let BullMQ deduplicate one organization's job against another's, leaving the second silently unprocessed while its HTTP response claimed success. Scoping it also makes a repeated identical request idempotent instead of doubling the work.

Writing the proposals takes a row lock (`SELECT ... FOR UPDATE`, ordered by id) on the target cases at the top of the transaction. `ExtractedProposal` has no unique constraint on `targetTestCaseId`, so the check-then-create that precedes each write is not atomic on its own: a chunk redelivered after the worker lock expires could pass the pending check concurrently with the original and write a second proposal for the same case, spending a second credit for one chunk. The lock makes the second writer wait and then observe what the first wrote. Ordering the ids keeps two chunks with overlapping targets from deadlocking against each other.

### Chunking, and why the 20-case cap stays

`MAX_EXTRACTED_CASES` bounds one model response's schema. Raising it to cover a large file would widen the blast radius of a single call against the existing output-token ceiling, for a problem chunking already solves. A file with more target cases than the cap becomes several `document-file` jobs over the same file, each carrying its own slice of the target keys and each a separate model call.

The 60,000-character source cap is unchanged and interacts with this: a declaration past the truncation point can never match, on any retry, because the cutoff is deterministic. That is a carried-over limitation of every job kind, recorded here so it is not mistaken for a chunking bug.

### Credits and the daily budget

A credit is spent per real provider call, so a `document-file` job costs one credit per chunk — one credit per file for the overwhelming majority of files, which is the rule product copy states. Charging per matched case was rejected: the provider bills per call, and pricing by case count would make a 20-case file ten times more expensive than a 2-case file that needed the identical single call.

`AiDailyBudget` (`apps/api/src/modules/ai/ai-daily-budget.service.ts`) caps the calls made against the platform's shared `GEMINI_API_KEY`. It is a Redis counter keyed by the Pacific calendar day, not UTC, because the provider's own rate limits reset at midnight Pacific; keying the gate to any other boundary would drift out of sync by up to eight hours, either refusing calls the provider would still serve or admitting calls into a quota already spent. `AERIS_DAILY_BUDGET` sets the cap and has no default — the right number depends on the paid tier behind the key, which only the account owner can read back.

The counter is reserved with an `INCR` before the call and rolled back with a `DECR` when the reservation exceeds the cap, so a refused job never reaches the provider. The check sits after the source read and before the extractor: a file that could not be fetched never made a provider call, so it must not consume a slot. An exhausted budget routes every target of the job to the manual-review fallback with reason `quota-exhausted`, keeping the guarantee that nothing detected in the repository disappears without a trace.

This budget protects the platform key, not any one organization's `aiCredits` — the two limits are independent and both must pass. A call made with an organization's own key bypasses it. No such path exists for extraction today, so the bypass is written as a flag that is unconditionally false and becomes meaningful the moment bring-your-own-key extraction lands.

### Suite-level summary

Suite metadata (name, description, tags) is written directly to the `Suite` row. There is no proposal or approval step for suites, unlike case documentation: `ExtractionProcessor` writes with `PrismaService.suite.update`/`updateMany` itself, inside a transaction, instead of creating something a reviewer must decide on later.

Two paths produce it:

1. **Inline, from a `document-file` job.** When the model returns a `suite` object alongside the extracted cases, and every documented target in that job belongs to a single suite, `ExtractionProcessor.applySuiteMetadata` locks the suite row (`SELECT ... FOR UPDATE`) and writes its name, description and tags in the same transaction as the case documentation.
2. **Standalone, from a `document-suite-metadata` job.** `ExtractionService.enqueueDocumentFiles` also enqueues one of these per suite whose documentation is still incomplete, independent of any single file. `ExtractionProcessor.processDocumentSuiteMetadata` reads the suite's active/draft cases (titles and objectives, up to `SUITE_SUMMARY_MAX_CASES`), asks `GeminiExtractor.summarizeSuite` for a title, description and tags (prompt `suite-summary-v1`, `apps/api/src/modules/ai/suite-summary-prompt.ts`), and writes the result in its own transaction (`ExtractionProcessor.persistSuiteSummary`).

Both paths respect a suite name a person has already set: when `Suite.nameSource` is `'human'`, the name itself is left untouched, but the description and tags still refresh from the latest summary. A later Aeris write only ever renames a suite whose current name Aeris set (`nameSource: 'aeris'`, or the ingestion default).

Tags are unioned, not replaced: `mergeSuiteTags` keeps every existing tag and appends newly proposed tags not already present, capped at 20 total (`SUITE_TAG_CAP`) so the list cannot grow without bound across repeated runs. A human-added tag Aeris never proposed is never dropped.

A proposed name can collide with another suite's unique name constraint within the project. Both paths open an explicit `SAVEPOINT` before writing and, on a caught `P2002`, roll back to it, log the skip, and retry the write without the name change, keeping the description and tag update. Without the savepoint, the caught error would leave the whole transaction aborted on PostgreSQL and lose any case documentation already written earlier in the same transaction.

Both paths also update the suite's documentation-state columns (`documentationOutcome`, `documentationMissing`, `documentationOutcomeAt`, `documentationSkipReason`) from the same completeness check case documentation uses (`assessSuiteDocumentation`).

`documentationQueuedAt` marks which standalone `document-suite-metadata` execution currently owns the suite's outcome write. `persistSuiteSummary` reads it under the same row lock it writes through: if the suite no longer exists, or its `documentationQueuedAt` is already `null`, a fresher execution (a redelivered or retried job) already resolved this suite, so the current execution spends no credit and writes nothing. Otherwise it spends the credit and writes with `suite.updateMany({ where: { id, documentationQueuedAt: { not: null } } })`, so a stale execution racing behind a fresher one can never overwrite what the fresher one already wrote. The inline `document-file` path does not own that flag, since the file's job can run before, or without, any standalone suite job ever being enqueued, so `applySuiteMetadata` neither gates on `documentationQueuedAt` nor clears it.

`enqueueDocumentFiles` decides `requestSuiteSummary` per `document-file` job, never as one flat value for the whole batch. For a suite-scoped request, every job still carries `requestSuiteSummary: false`: when the suite is incomplete, the standalone `document-suite-metadata` job enqueued alongside them is the batch's only producer of suite metadata; when the suite is already complete (or its row is gone by the time `buildSuiteMetadataJob` re-reads it), no job needs to produce anything, so asking again would only waste a credit and race a fresh write against complete or human-written data. A project-scoped request has no standalone job to fall back on, so `enqueueDocumentFiles` groups the batch's rows by suite (`suiteId`, selected alongside the other candidate fields), issues one batched `suite.findMany` across every suite that batch actually touches — never one query per file — and runs the shared `assessSuiteDocumentation` check against that result to know which suites are still incomplete. Only the first job (in enqueue order) whose targets belong entirely to one still-incomplete suite gets `requestSuiteSummary: true`; every later job touching that same suite, and every job whose targets span more than one suite, gets `false`. This mirrors the suite-scoped invariant exactly: at most one producer runs per suite per request, and zero run once the suite is complete. The inline path in `ExtractionProcessor.applySuiteMetadata` remains project scope's only source of suite metadata, and it already refuses to write over a human-set name (`nameSource: 'human'`), so that guard needed no change. `buildSystemInstruction`'s fourth parameter (`requestSuiteSummary`, default `true`) is the switch, threaded from `ExtractionJobData`'s `document-file.requestSuiteSummary` through `ExtractionInput.requestSuiteSummary`.

### Advisory observations

Each extracted case may carry up to five `observations` of up to 200 characters, written in the organization's language, about the testing practice the code shows: a test without an assertion, a wait on a fixed delay, two tests verifying the same thing. The prompt forbids proposing code or rewriting assertions, per the thesis limit that the platform goes from code to documentation and never the other way. Observations are stored on the proposal and shown to the reviewer; they never become part of a `TestCaseVersion` and are never published. Like every model output they are bounded in Zod and rendered as text, never as HTML.

### Locale re-documentation

Every proposal the processor writes, including manual-review fallbacks, records the locale it was written in, and publishing copies it onto the new `TestCaseVersion`. Each case exposes `documentedLocale`, null for a case documented before locales were recorded. The file-level action accepts `mode: 'stale-locale'`, which targets documented automated cases whose version locale is missing or differs from the organization's locale, instead of undocumented ones. A missing locale counts as stale on purpose: nothing backfills that column, so treating it as unknown would hide every older case from re-documentation forever. The web shows a "documented in ..." badge when a case's locale differs from the viewer's and offers the re-documentation action next to the primary one; the case card itself no longer carries a per-case document button, because documenting one case at a time costs one credit per case where the suite action costs one per file for the same cases.

### Uncaught errors always land in the fallback

`ExtractionProcessor.runExtraction` wraps the entire extraction path — source read, access-token decryption, and the extractor call — in a try/catch. If any of those throws instead of returning a typed result (e.g. `EncryptionService.decrypt` throwing on a malformed ciphertext), the job still ends in the manual-review fallback with reason `extraction-failed`, instead of failing the BullMQ job with no proposal at all.

### Decided-proposal guard (redelivery safety)

Proposals produced from a code change are keyed by `(codeChangeId, automationKey)`. Because the queue uses `removeOnComplete: true`, a completed job's id can be reused, so a redelivered or retried job could otherwise flip an already-**approved**/**rejected**/**changes_requested** proposal back into review. Before writing, `ExtractionProcessor` batches a lookup of the existing proposals for every `automationKey` in the current batch (one `findMany`, not one query per case) and then, per case:

- If it exists and its status is **not** `in_review`, the redelivery is skipped and logged — the decided proposal is left untouched.
- If it exists and is still `in_review`, its **evidence row is updated in place** (title/uri/excerpt) and the proposal fields are refreshed — no new orphaned `Evidence` row is created for the same natural key.
- If it doesn't exist, a new `Evidence` row and a new proposal are created.

The batch read is a snapshot — it does not itself prevent two concurrent workers from both reading "not found" for the same natural key. The actual atomicity comes from the database: `(codeChangeId, automationKey)` is a unique constraint, so when two jobs race to `create` the same proposal, the loser gets a Prisma `P2002` unique-violation instead of a duplicate row. `ExtractionProcessor` catches that violation, re-reads the winning row, and falls through to the same in-review-status-checked update path described above — so the losing job's data is never dropped, and a decided proposal still can't be reopened by a race. `@Processor(EXTRACTION_QUEUE)` sets `lockDuration: 120_000` (2 minutes) so a normal Gemini call never causes BullMQ to consider the job stalled and redeliver it while the original is still running; the P2002 fallback is a safety net for the rare case a redelivery happens anyway.

On PostgreSQL, catching an error raised by one statement inside an interactive `$transaction` does not make the transaction usable again — a failed statement moves the whole transaction into the aborted state (`25P02 current transaction is aborted, commands ignored until end of transaction block`), and Prisma's interactive transactions do not add implicit savepoints. Without one, the `findFirst`/`update` that follow a caught `P2002` would themselves throw `25P02`, the entire batch would roll back, and the job would degrade to the generic `extraction-failed` fallback even though the race was already handled correctly at the application level. `ExtractionProcessor` opens an explicit `SAVEPOINT extraction_proposal` on the same `tx` right before the `Evidence` row is created, so a caught `P2002` can `ROLLBACK TO SAVEPOINT extraction_proposal` — discarding both the failed `create` and the `Evidence` row created just before it — and then continue reading and conditionally updating the winner on a transaction that is valid again. The savepoint is released on both branches — right after a successful create, and right after the `ROLLBACK TO SAVEPOINT` on a caught `P2002` — so it never lingers as an open subtransaction that the next loop iteration would stack on. The identifier is a fixed literal, never interpolated from request data.

The unit suite mocks Prisma, so it cannot exercise real Postgres transaction-abort semantics; it only asserts that the processor issues `SAVEPOINT` / `ROLLBACK TO SAVEPOINT` / `RELEASE SAVEPOINT` in the right order relative to the `Evidence` and `ExtractedProposal` calls. A Postgres integration test (real transaction, two concurrent connections racing the same natural key) is a recommended follow-up to validate the behavior against the actual database instead of a mock.

### Deduplication within a batch

A single extraction can return multiple cases sharing the same `automationKey` (a model quirk, or two declarations that stringify to the same reporter name). `ExtractionProcessor` deduplicates by `automationKey` before persisting, keeping only the first occurrence.

## Output locale

The extractor writes `title`, `objective`, `preconditions`, `steps` and `expectedResult` in whichever locale `ExtractionProcessor.resolveLocale` resolves for the project's organization:

1. Look up the `OrgMember` with `role: owner` for the organization (earliest `joinedAt` wins if there is more than one).
2. Use that owner's `User.locale`.
3. Fall back to `'es'` if there is no owner on record, or the owner's locale is anything other than `'en'`.

There is no per-organization locale setting yet — this reads the owner's personal `User.locale`, the same field the chat assistant already uses for its own locale resolution.

## Suite resolution order

For a code-change job (no suite already known), `ExtractionProcessor.resolveSuiteId` picks the target suite in this order:

1. An existing `TestCase` in the project whose `automationFilePath` equals the extracted file's path — its `suiteId` wins. This is the reliable signal: pytest/Java/gtest paths never equal a suite's display name, so this must be checked before the name-based fallback.
2. A `Suite` whose `name` equals the file path (the older heuristic, kept for projects that named a suite after a single spec file).
3. The project's default suite (`isDefault: true`, oldest first), or `null` if the project has no suites at all.

## AI entitlement

Every AI call — chat replies, document-case extraction, and code-change extraction — is gated by the organization's entitlement: `Organization.aiEnabled` (boolean) and `Organization.aiCredits` (integer, decremented per successful call). `AiEntitlementService` (`apps/api/src/modules/ai/ai-entitlement.service.ts`) is the single source of truth:

- `isEntitled(organizationId)` — a plain read (`aiEnabled && aiCredits > 0`), used as a cheap pre-check before doing any paid work.
- `spendCredit(organizationId)` — an atomic `updateMany` that only decrements when `aiEnabled` is true and `aiCredits > 0`; if it matches zero rows, the caller must treat the attempt as **not entitled**, even though the check moments earlier passed (a concurrent request may have spent the last credit in between).

`ExtractionProcessor` checks `isEntitled` before calling the extractor at all (never call the provider for a non-entitled org — the job goes straight to the manual-review fallback with reason `ai-not-enabled`), and spends the credit right after a real provider response (`extracted` or `no-tests-found`, not `provider-unavailable`) — a `no-tests-found` response still cost tokens, but a provider failure was never a billable call.

When there are cases to persist, `spendCredit` is called **inside the same `$transaction` that writes the proposals** (`ExtractionProcessor.persistExtracted`), passing the transaction client through to `AiEntitlementService.spendCredit(organizationId, tx)`. That means a credit is only ever actually spent if the proposals it paid for actually land in the database: if any write after the decrement throws, the whole transaction — decrement included — rolls back, and the job falls through to the outer `runExtraction` catch, which creates the usual `extraction-failed` manual-review proposal instead of silently keeping a spent credit with nothing to show for it. For the `no-tests-found` and no-matching-case paths (which never call `persistExtracted`), the credit is still spent outside a transaction, since there's no proposal write to keep it atomic with.

`ChatService.sendMessage` follows the same pattern: `spendCredit` runs inside the `$transaction` that creates the assistant message and updates the thread, so a persistence failure after a successful provider reply rolls the credit back together with the discarded assistant turn instead of charging for output that was never saved. If the decrement itself reports no credits left, the transaction returns without writing anything and the request reports `ai-not-enabled` — the user's message (persisted before the provider call) is kept, matching the existing "provider-unavailable keeps the user message, never persists a half-formed assistant turn" rule.

At the HTTP layer, `AiEntitlementGuard` (`apps/api/src/modules/ai/guards/ai-entitlement.guard.ts`) reads `request.org` (populated by `OrgScopeGuard`, which must run first) and calls `isEntitled` before letting the request reach the controller method, throwing `403 { code: 'ai-not-enabled' }` otherwise. It is applied, after `OrgScopeGuard`, to:

- `POST /projects/:projectId/chat/threads/:threadId/messages`
- `POST /suites/:id/cases/:caseId/document`

Both of those endpoints are additionally throttled (`@Throttle`) against runaway cost even for entitled organizations: 20/min for chat messages, 10/min for document-case, and 20/min for thread creation (`POST /projects/:projectId/chat/threads`, which is not gated by entitlement since it never calls the provider by itself).

## Deleting a chat thread keeps the proposals it produced

`DELETE /projects/:projectId/chat/threads/:threadId` (`ChatService.deleteThread`) removes a conversation and, through the `onDelete: Cascade` on `ChatMessage.thread`, every message inside it. It removes nothing else. The `ExtractedProposal` and `Evidence` rows created by "send to review" from that conversation survive the deletion, and their `Evidence.uri` (`qably://chat/{threadId}/{messageId}/{caseIndex}`) keeps pointing at a thread that no longer exists.

That dangling reference is deliberate. A proposal that a person already reviewed, or already approved into an official case, is a governed artifact of the project; it must not disappear because somebody tidied up their own chat history. The URI stays as the record of where the case came from, and `ChatService.loadSentProposalIds` — the only reader of that prefix — is scoped to a thread that is still being displayed, so it is never asked about a deleted one.

The consequence to know about: after deleting a thread, "send to review" idempotency for its messages is gone with it, but so is any way to reach those messages, so no duplicate can be created from them.

Deletion is scoped through the same `findThread` used by every other thread operation, so it only ever matches a thread that belongs to the caller **and** to a project inside the caller's organization. It is not gated by `AiEntitlementGuard` and not throttled: it calls no provider and costs nothing.

## Manual integration check

`apps/api/src/modules/ai/gemini.extractor.integration.spec.ts` calls the real Gemini API against all three prompts this module and the chat module send — `extraction-v9` (`GeminiExtractor.extract`), `suite-summary-v1` (`GeminiExtractor.summarizeSuite`) and `chat-v4` (`GeminiChatAssistant.reply`) — with tiny synthetic fixtures written for the test (never real customer code), and asserts each response matches its Zod schema (`extractionOutputSchema`, `suiteSummarySchema`, `suggestedCasesSchema`). It never asserts exact wording, since model output is not deterministic.

Every `describe` block in the file is skipped unless `GEMINI_API_KEY` is present in the environment running the test, so it never runs in CI by default and costs nothing unless explicitly invoked with a key. **This is intentional and permanent**: the key is never added to CI, and this spec is run only locally by whoever holds the key.

Jest in this project does not load `.env` on its own — `dotenv/config` is only imported by `apps/api/src/main.ts`, the server entrypoint, and a plain `jest` run never executes it. The key has to be present in the shell's own environment for the one command; it does not need to be committed anywhere or exported permanently.

From `apps/api`, with a real key:

PowerShell:

```powershell
cd apps\api
$env:GEMINI_API_KEY = "<your key>"
npx jest --maxWorkers=2 gemini.extractor.integration
Remove-Item Env:GEMINI_API_KEY
```

Git Bash:

```bash
cd apps/api
GEMINI_API_KEY="<your key>" npx jest --maxWorkers=2 gemini.extractor.integration
```

Both forms scope the key to that single command; neither leaves it set in the shell afterwards. `GEMINI_MODEL` is optional and defaults to `gemini-3.1-flash-lite` inside the spec when unset — export it the same way, before the `npx jest` call, to point the check at a different model.

A pass reports all three `describe` blocks (`GeminiExtractor (manual integration, real API)`, `GeminiExtractor.summarizeSuite (manual integration, real API)`, `GeminiChatAssistant (manual integration, real API)`) as green, no failures and no skips. Without the key, the same command reports every test in the file as skipped, never failed — that is the expected state for every CI run and for a local run with nothing exported.
