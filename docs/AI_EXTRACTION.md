# AI test case extraction

`apps/api/src/modules/ai` and `apps/api/src/modules/review` turn a test source file into documented, reviewable test case proposals. A human always confirms the result before it becomes an official test case — the model never publishes anything on its own.

## Provider

The extractor is Gemini through the official `@google/genai` SDK (`GoogleGenAI({ apiKey })`, `models.generateContent`). The port is `TestCaseExtractor` (`apps/api/src/modules/ai/extraction.contracts.ts`), so a different provider can be swapped in later without touching `ExtractionProcessor`.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | no | Activates `GeminiExtractor`. Without it, `AiModule` binds `DisabledExtractor`, which always returns `provider-unavailable: 'GEMINI_API_KEY not configured'` — every code change still gets a manual-review proposal, nothing is lost. |
| `GEMINI_MODEL` | no | Model id passed to `generateContent`. See `apps/api/src/config/env.ts` for the current default; override it to move to a different Gemini model without a code change. |

## How to change the model

Set `GEMINI_MODEL` to any model id Gemini's `models.list()` reports as available for `generateContent`, and restart the API. No code change is required.

## Request shape

`GeminiExtractor` (`apps/api/src/modules/ai/gemini.extractor.ts`) sends the whole file content as `contents`, with:

- `systemInstruction`: the extraction prompt, versioned as `EXTRACTION_PROMPT_VERSION` (`apps/api/src/modules/ai/extraction-prompt.ts`) and stored on every proposal (`ExtractedProposal.promptVersion`) for audit.
- `responseMimeType: 'application/json'` and `responseJsonSchema`: forces a structured `{ cases: [...] }` reply.
- `temperature: 0.2`, `maxOutputTokens: 8192`.
- `httpOptions.timeout: 60000` and `httpOptions.retryOptions` (3 attempts, retrying `408/429/500/502/503/504`).

A `401`/`403` from the API (invalid key) is never retried and immediately resolves to `provider-unavailable: 'invalid-credentials'`.

## Limits

- Source content is capped at **60,000 characters** per file (`SourceReader`, `apps/api/src/modules/repository/source-reader.ts`); anything longer is truncated before it reaches the model.
- The model may return at most **20 cases** per file (`MAX_EXTRACTED_CASES`, `apps/api/src/modules/ai/extraction.contracts.ts`).
- Each case field is length-bounded (title ≤120, objective/expectedResult ≤500, steps 1–20 × ≤300, preconditions ≤10 × ≤300, sourceExcerpt ≤600) and validated with Zod (`extractedCaseSchema`) before it is persisted. A case that violates the schema is dropped and counted, not persisted — it never fails the rest of the batch.

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

For a **code-change** job, "no test declarations found" and "no case for a specific key" do not apply — a code-change extraction persists whatever cases the model found, with no single case to match against. A document-case job always targets exactly one existing automated case, so any outcome that doesn't produce that case ends in the fallback instead of silently doing nothing.

### Uncaught errors always land in the fallback

`ExtractionProcessor.runExtraction` wraps the entire extraction path — source read, access-token decryption, and the extractor call — in a try/catch. If any of those throws instead of returning a typed result (e.g. `EncryptionService.decrypt` throwing on a malformed ciphertext), the job still ends in the manual-review fallback with reason `extraction-failed`, instead of failing the BullMQ job with no proposal at all.

### Decided-proposal guard (redelivery safety)

Proposals produced from a code change are keyed by `(codeChangeId, automationKey)`. Because the queue uses `removeOnComplete: true`, a completed job's id can be reused, so a redelivered or retried job could otherwise flip an already-**approved**/**rejected**/**changes_requested** proposal back into review. Before writing, `ExtractionProcessor` looks up the existing proposal by that natural key:

- If it exists and its status is **not** `in_review`, the redelivery is skipped and logged — the decided proposal is left untouched.
- If it exists and is still `in_review`, its **evidence row is updated in place** (title/uri/excerpt) and the proposal fields are refreshed — no new orphaned `Evidence` row is created for the same natural key.
- If it doesn't exist, a new `Evidence` row and a new proposal are created.

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

`ExtractionProcessor` checks `isEntitled` before calling the extractor at all (never call the provider for a non-entitled org — the job goes straight to the manual-review fallback with reason `ai-not-enabled`), and calls `spendCredit` right after a real provider response (`extracted` or `no-tests-found`, not `provider-unavailable`) — a `no-tests-found` response still cost tokens, but a provider failure was never a billable call. If the decrement then fails, the job falls back to manual review instead of persisting proposals nobody paid for.

`ChatService.sendMessage` calls `spendCredit` once the assistant has actually replied; if it fails, the user's message stays persisted but the assistant turn is discarded and the request reports `ai-not-enabled` — matching the existing "provider-unavailable keeps the user message, never persists a half-formed assistant turn" rule.

At the HTTP layer, `AiEntitlementGuard` (`apps/api/src/modules/ai/guards/ai-entitlement.guard.ts`) reads `request.org` (populated by `OrgScopeGuard`, which must run first) and calls `isEntitled` before letting the request reach the controller method, throwing `403 { code: 'ai-not-enabled' }` otherwise. It is applied, after `OrgScopeGuard`, to:

- `POST /projects/:projectId/chat/threads/:threadId/messages`
- `POST /suites/:id/cases/:caseId/document`

Both of those endpoints are additionally throttled (`@Throttle`) against runaway cost even for entitled organizations: 20/min for chat messages, 10/min for document-case, and 20/min for thread creation (`POST /projects/:projectId/chat/threads`, which is not gated by entitlement since it never calls the provider by itself).

## Manual integration check

`apps/api/src/modules/ai/gemini.extractor.integration.spec.ts` calls the real Gemini API with a tiny fixture and asserts the response matches `extractionOutputSchema` — it never asserts exact wording, since model output is not deterministic. The `describe` block is skipped unless `GEMINI_API_KEY` is present in the environment running the test, so it never runs in CI by default and costs nothing unless explicitly invoked with a key:

```bash
GEMINI_API_KEY=... pnpm --filter @qably/api test -- src/modules/ai/gemini.extractor.integration.spec.ts
```
