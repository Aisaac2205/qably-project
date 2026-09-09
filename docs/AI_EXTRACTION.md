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
- Those bounds live **only** in Zod. The JSON schema sent to the provider (`RESPONSE_JSON_SCHEMA`) names the fields, the enum and the required list, and caps only the top-level `cases` array at `MAX_EXTRACTED_CASES`. It carries no `maxLength` and no nested `minItems`/`maxItems`, because Gemini compiles the response schema into a constrained-decoding automaton and rejects one with string length limits and nested array limits as "too many states for serving" (HTTP 400; `gemini-3.1-flash-lite` reports it only as a generic `INVALID_ARGUMENT`). With the bounded schema in place every real extraction failed before the first token was generated, while the unit suite stayed green because it never calls the provider. `gemini.response-schema.spec.ts` pins the invariant so a future "tighten the schema" change cannot silently reintroduce it; the manual integration spec is the only check that talks to the real model.

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

`resolveAutomationFilePath` (`apps/api/src/modules/review/lib/resolve-automation-file-path.ts`) closes that gap without guessing, by looking the path up from data the platform already owns:

1. The most recent `ExtractedProposal` in the same project with the same `automationKey`, joined to its `CodeChange.filePath`. This is the strongest provenance: the key came from a file the repository webhook detected and Qably extracted.
2. Failing that, a sibling `TestCase` in the same project with the same `automationKey` that already knows its path.

Both lookups hinge on `automationKey` being identical on the ingest side and the extraction side. That is not a coincidence — the extraction prompt requires the model to emit the reporter's runtime name byte-for-byte precisely so the two pipelines can be joined here.

No path is ever derived from `className` or a filename heuristic. A guessed path is not evidence, and per-framework derivation rules would quietly widen the platform beyond the single validated automation framework.

When neither lookup finds anything, `enqueueDocumentCase` returns `no-source-file` (HTTP 409) and the processor logs and stops. The web surface treats that as an explanatory state rather than a failure: it tells the reviewer no repository file matches this case and offers manual documentation instead.

### Fallback matrix

| Situation | Applies to | `objective` reason |
|---|---|---|
| Project has no repository connection | code-change and document-case | `no-connection` |
| Organization is not entitled to AI (see below) | code-change and document-case | `ai-not-enabled` |
| `SourceReader` could not read the file | code-change and document-case | the reader's reason (e.g. `http-404`, `timeout`, `fetch-failed`) |
| Credit decrement failed after a successful model call (race with another job) | code-change and document-case | `ai-not-enabled` |
| Model reports no test declarations at all | **document-case only** | `no-tests-found` |
| Model returns cases, but none match the target case's `automationKey` | **document-case only** | `automation-key-not-found` |
| Model call fails (invalid credentials, timeout, schema violation, empty response) | code-change and document-case | the provider's reason (e.g. `invalid-credentials`) |
| An uncaught error is thrown anywhere in the extraction path | code-change and document-case | `extraction-failed` |
| The platform's daily Aeris budget is spent | all three job kinds | `quota-exhausted` |

For a **code-change** job, "no test declarations found" and "no case for a specific key" do not apply — a code-change extraction persists whatever cases the model found, with no single case to match against. A document-case job always targets exactly one existing automated case, so any outcome that doesn't produce that case ends in the fallback instead of silently doing nothing.

## File-level documentation

A repository connected for the first time arrives with every automated case already created by CI and none of them documented. Asking a reviewer to press a per-case button several hundred times is not a workflow, and it bills a model call per case for work the model does per file anyway: the extractor reads a whole test file and can return up to `MAX_EXTRACTED_CASES` cases from that one call.

The `document-file` job kind is that unit. `ExtractionService.enqueueDocumentFiles` collects the automated cases in a suite or project that have no steps and no proposal already in review, groups them by resolved `automationFilePath`, and enqueues one job per file carrying the list of `automationKey`s to fill. `POST /suites/:id/document` and `POST /projects/:id/document` expose it, both behind `AiEntitlementGuard` and a throttle, and both answer with `filesEnqueued`, `casesTargeted` and a `casesSkipped` breakdown so the caller can see what was left out and why rather than assuming everything was queued.

The processor matches each returned case to a target by `automationKey`, the same join key run ingestion uses, and writes one `ExtractedProposal` per matched target. A target the model never returned gets its own `automation-key-not-found` fallback: a case that could not be documented is visible in the review inbox, never a silent omission.

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

A file-level job also asks the model for a `suite` object, a title of up to 80 characters and a description of up to 300, in business language, requested only for file-level jobs because only there is the file known to be the whole suite. The processor writes one `SuiteProposal` per job when the model returned one and every target belongs to a single suite, guarded by the same "already in review" check the case proposals use. Approving it renames and describes the suite and stamps `nameSource = 'aeris'`, unless a person named the suite (`nameSource = 'human'`, set by any manual rename), in which case the decision is recorded and the suite is left alone. A later Aeris proposal may refresh a name Aeris set before. Suite proposals have their own listing and decision endpoints under `/review/suite-proposals` rather than sharing the case proposal list: a `ReviewDecision` row references a case proposal by foreign key, so a suite decision is recorded on the proposal itself (`status`, `decidedAt`).

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

`apps/api/src/modules/ai/gemini.extractor.integration.spec.ts` calls the real Gemini API with a tiny fixture and asserts the response matches `extractionOutputSchema` — it never asserts exact wording, since model output is not deterministic. The `describe` block is skipped unless `GEMINI_API_KEY` is present in the environment running the test, so it never runs in CI by default and costs nothing unless explicitly invoked with a key:

```bash
GEMINI_API_KEY=... pnpm --filter @qably/api test -- src/modules/ai/gemini.extractor.integration.spec.ts
```
