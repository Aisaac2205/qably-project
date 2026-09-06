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

Whenever the extractor cannot produce a result — no repository connection, the source file could not be read (`SourceReader` returns `unavailable`), the model call fails after retries, or the response fails schema validation — `ExtractionProcessor` still creates exactly one `ExtractedProposal`:

- `title` = the file path (or, for a documented case, the case's own file).
- `objective` = the failure reason, bounded to 500 characters.
- `needsManualReview: true`.
- `status: in_review`.

The job completes normally in this case; there is no retry loop over a missing API key. A human can then document the case by hand from the review inbox. Retrying is reserved for actual infrastructure failures (a broken database call), which propagate and let BullMQ's `attempts: 3` / exponential backoff take over.

## Manual integration check

`apps/api/src/modules/ai/gemini.extractor.integration.spec.ts` calls the real Gemini API with a tiny fixture and asserts the response matches `extractionOutputSchema` — it never asserts exact wording, since model output is not deterministic. The `describe` block is skipped unless `GEMINI_API_KEY` is present in the environment running the test, so it never runs in CI by default and costs nothing unless explicitly invoked with a key:

```bash
GEMINI_API_KEY=... pnpm --filter @qably/api test -- src/modules/ai/gemini.extractor.integration.spec.ts
```
