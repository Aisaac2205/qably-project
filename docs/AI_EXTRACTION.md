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
- The model may return at most **20 cases** per file (`MAX_EXTRACTED_CASES`, `apps/api/src/modules/ai/extraction.contracts.ts`). The cap is enforced in code, not in the schema: `GeminiExtractor.toOutcome` keeps only the first `MAX_EXTRACTED_CASES` schema-valid cases and drops the rest with a `this.logger.warn` naming the file path and the number dropped — a warning distinct from the one it already logs for individually invalid cases. The Zod `extractionOutputSchema` (`z.array(extractedCaseSchema).max(MAX_EXTRACTED_CASES)`) carries the same bound, but it runs only in the integration and contract specs, never inside `toOutcome`; the live cap is the slice.
- Each case field is length-bounded (title ≤120, objective/expectedResult ≤500, steps 1–20 × ≤300, preconditions ≤10 × ≤300, sourceExcerpt ≤600, observations ≤5 × ≤200) and validated with Zod (`extractedCaseSchema`) before it is persisted. Over-long free text and over-long lists are repaired instead of dropped; see "Fields over the limit: repaired, not dropped" below. A case that still violates the schema is dropped, and the warning names the failing fields; it never fails the rest of the batch.
- Those bounds live **only** in Zod and in `GeminiExtractor.toOutcome`, never in the JSON schema sent to the provider. `RESPONSE_JSON_SCHEMA` and `TARGETED_RESPONSE_JSON_SCHEMA` name the fields, the enum and the required list, and carry no array or string bounds at all — no `maxLength`, no `minLength`, no `maxItems`, no `minItems`, anywhere, including the top-level `cases` array — because Gemini compiles the response schema into a constrained-decoding automaton and rejects a bounded one as "too many states for serving" (HTTP 400; `gemini-3.1-flash-lite` reports it only as a generic `INVALID_ARGUMENT`). **Incident, 2026-09-26**: `TARGETED_RESPONSE_JSON_SCHEMA` added one optional property (`targetRef`) to the case item while `RESPONSE_JSON_SCHEMA.properties.cases` still carried a top-level `maxItems: 20` — that combination alone was enough to cross the state limit, so every targeted extraction (document-file jobs, "Volver a documentar con Aeris") returned HTTP 400 before generating a token, while the unit suite stayed green because it mocks the client and never calls the provider. The fix removed `maxItems` entirely and moved the cap into `GeminiExtractor.toOutcome`; the rule going forward is that a provider schema carries no bounds anywhere, and every bound lives in code. `gemini.response-schema.spec.ts`, `chat.response-schema.spec.ts` and `gemini.suite-summary-response-schema.spec.ts` each pin the same invariant for their own response schema, so a future "tighten the schema" change on any of the three cannot silently reintroduce it. The manual integration spec (`gemini.extractor.integration.spec.ts`) is the only check that validates schema acceptance against the real model — run it after any schema or prompt change, with a real `GEMINI_API_KEY` (see "Manual integration check" below).
- `extractedCaseSchema` also rejects a case whose `title`, once trimmed, equals its `automationKey`: a model that falls back to echoing the reporter's runtime name as the human-facing title produces a case that `assessCaseDocumentation` (`packages/types/src/documentation-completeness.ts`) already treats as an undocumented title, so extraction now refuses to persist that shape in the first place instead of writing a "documented" case that the completeness rule would immediately flag as incomplete. `extractedCaseObjectSchema` (the same fields, without that cross-field check) is what `chat.contracts.ts`'s `suggestedCaseSchema` derives from via `.omit({ automationKey: true, sourceExcerpt: true })`, since a chat suggestion that carries no `automationKey` has nothing to compare the title against. `extractedCaseObjectSchema` stays strict: it applies the same limits but repairs nothing, so chat suggestions keep their previous behavior.

### Fields over the limit: repaired, not dropped

A case whose free text exceeds its limit is kept and shortened. A case is dropped only when required content is missing or its shape is wrong, and every drop logs which field failed and with which Zod code.

**Why.** In production, the Railway logs showed `dropped 3 invalid case(s)` for `ai-entitlement.service.spec.ts` and `dropped 2 invalid case(s)` for `use-inbox-counts.test.tsx`. Because neither of the two extraction attempts returned a valid case, `extractWithDeclarationRetry` ended in `no-tests-found` and the user saw "Aeris detectó declaraciones de prueba en este archivo pero no logró documentarlas". The prompt asks for a short, literal quote in `sourceExcerpt` but sets no number for the case fields; the literal quote of a long test easily exceeds 600 characters, and that used to be enough to lose the whole case. The log at the time only counted drops, so it was not possible to confirm which field failed in those two files. The new log exists to answer that question next time.

#### What is repaired

| Field | Limit | If exceeded |
|---|---|---|
| `title` | 120 | Shortened, and a digest is appended (see "Title" below). |
| `objective`, `expectedResult` | 500 | Cut at a word boundary and ends with "…". |
| `sourceExcerpt` | 600 | Same as above. |
| Each item of `steps` and `preconditions` | 300 | Same as above, after removing the leading ordinal. |
| Each item of `observations` | 200 | Same as above. |
| `steps` | 1 to 20 items | The first 20 are kept. |
| `preconditions` | up to 10 items | The first 10 are kept. |
| `observations` | up to 5 items | The first 5 are kept. |
| `automationKey` | 372 | Unchanged: cut by code points with `truncateTo`. |

Shortening happens before the length is validated: first `trim()` and `min(1)`, then the transformation that shortens, and finally `max()` as a guard. This is the same pattern `automationKey` and the `listItem` ordinal already used.

`truncateOnWordBoundary` (`apps/api/src/common/text/truncate-on-word-boundary.ts`) shortens text with these rules:

1. It measures in UTF-16 units, the same unit Zod's `.max()` uses. Cutting by code points, as `truncateTo` does, could leave text containing emoji above the limit, and the case would be dropped anyway.
2. It reserves one character for "…", so the result never exceeds the limit.
3. It cuts at the last whitespace character (space, tab or line break) if that falls within the last 20% of the available space. If there is none, for example in a very long identifier or URL, it makes a hard cut.
4. It never splits a surrogate pair: if the cut falls between the two halves of an emoji, it steps back one unit.
5. It removes trailing whitespace before appending "…".

The trailing "…" tells the reviewer that the text was shortened. For `sourceExcerpt`, this means the quote is no longer complete, but it remains literal up to the cut.

#### Lists longer than the cap

When `steps` exceeds 20 items, `preconditions` exceeds 10 or `observations` exceeds 5, the first items are kept in their order and the excess is discarded before each item is validated. An invalid item that falls beyond the cap, for example a step `"21."` that is only an ordinal, is discarded with the excess and does not invalidate the case.

Keeping the prefix was chosen because every proposal goes through human review before publication. A case with its first 20 steps is visible in the review inbox, can be compared against `sourceExcerpt` and can be rejected. A dropped case, by contrast, never reaches the inbox and leaves no trace for the user. The cost is that the tail of the steps is lost, which usually holds the last assertions; `expectedResult` is a separate field and is not affected.

#### Title

The title becomes the official name of the case on approval, and `TestCase` has `@@unique([suiteId, name])` (`apps/api/prisma/schema.prisma`). The review inbox does not allow editing the title before approving: `POST /review/proposals/:id/approve` accepts only a comment. So a name collision on approval ends in a 409 that the reviewer can only resolve by rejecting the proposal. The 409 body names the failing constraint and the official case that already holds the title; see [Review approval conflicts](REVIEW_APPROVAL_CONFLICTS.md).

| Option | Cases lost | Risk to identity |
|---|---|---|
| Drop the case (previous behavior) | Every case with a title over 120 | None |
| Shorten with nothing else | None | Two titles sharing their first 120 characters, typical of `it.each` rows, end up with the same name and the second collides on approval |
| **Shorten and append a digest (chosen)** | None | None in practice |

`fitCaseTitle` (`apps/api/src/modules/ai/fit-case-title.ts`) cuts the title at a word boundary, appends "…" and ends with ` (xxxxxx)`, where `xxxxxx` are the first 6 hexadecimal characters of the SHA-256 of the full title. The result never exceeds 120 characters. A title of 120 characters or fewer does not change.

- **Deterministic.** The same test produces the same name on every new extraction, so documenting a file again does not invent new names.
- **Distinguishes what the cut would hide.** Two different titles that differ only after the cut end with different digests. The probability that two different long titles share a digest is 1 in 16.7 million.
- **Adds no new collisions.** Two identical titles produce the same digest, but that collision already existed without the cut.
- **Cost.** The official name carries a hard-to-read suffix. It only appears on titles that already violated the limit and were previously lost.

The check "the title must differ from the `automationKey`" is evaluated on the original title, before shortening, and cut to the same 372 characters as the `automationKey`. That way, a model that returns a long `automationKey` as the title is still dropped, instead of passing the check thanks to the digest.

#### What is still dropped

- Required text that is empty after `trim()`: `title`, `objective`, `expectedResult`, `sourceExcerpt`, or a step or precondition that contains only an ordinal.
- A required field that is missing or of another type, for example `steps` as text instead of a list.
- Empty `steps`.
- `priority` outside `critical`, `high`, `medium` or `low`.
- A `title` equal to the `automationKey` according to `normalizeTitleForComparison`.

#### How to read the log line

```
Gemini response for src/modules/ai/ai-entitlement.service.spec.ts dropped 3 invalid case(s): objective too_small x2, steps[] too_small x1
```

- The prefix `Gemini response for <file> dropped <n> invalid case(s)` did not change, so existing log searches keep working.
- Each item after the colon has the form `<field> <Zod code> x<cases>`, ordered from most to least frequent. The number counts cases, not errors: a case with two empty steps adds one to `steps[] too_small`.
- `[]` marks a list item. `case` means the model returned something that is not an object.
- Usual codes: `too_small` (empty text or empty list), `invalid_type` (missing field or a field of another type), `invalid_value` (`priority` outside the enum) and `custom` on `title` (the title repeats the `automationKey`).
- A `too_big` on a repaired field should never appear. If it does, the shortening has a bug.
- The line never includes case content or source code. `summarizeDroppedCases` (`apps/api/src/modules/ai/dropped-case-summary.ts`) reads only the path and the code of each issue, never `message` or `input`.

#### Scope

- The repair lives only in `extractedCaseSchema`, which `GeminiExtractor.toOutcome` and `extractionOutputSchema` use. Chat suggestions use `extractedCaseObjectSchema`, which stays strict; they have the same silent drop and remain as a follow-up.
- The repair shipped with `extraction-v11`, which gave the model no numbers. Since `extraction-v12` the prompt states the case field limits as numbers (see "Field limits in the prompt" below). The repair remains the safety net; whether it now runs less often has not been measured.
- `RESPONSE_JSON_SCHEMA` and `TARGETED_RESPONSE_JSON_SCHEMA` did not change and still carry no bounds, for the reason explained in the "Limits" list that precedes this section.

#### Verified Zod behavior

The implementation depends on these Zod 4 behaviors. They were verified against the documentation (context7, `/websites/zod_dev`) and by running them against the version installed in `apps/api` (4.4.3):

- `.transform()` and `z.preprocess()` return a `ZodPipe`. If the left side of a pipe fails, for example `min(1)`, the transformation does not run, so empty text is dropped instead of shortened.
- `z.preprocess(fn, schema).default([])` returns `[]` when the field is missing, and a non-list input reaches the list schema and produces `invalid_type`.
- `z.string().max(n)` counts UTF-16 units: two emoji measure 4.
- `safeParse` exposes `error.issues`, and each issue carries `code` and `path`, with list indices as numbers.

## Priority rubric (extraction-v12)

`extraction-v12` replaces the one-line priority sentence with an ordered, generic rubric that the model can apply from a single file, and states the case field limits as numbers. On a set written after the rubric text was frozen (six fixtures in Python, Java and Kotlin, 11 cases per run), 10 of 11 cases landed in their accepted sets in each of two runs, and none was rated `critical`, including a formatter under `billing/` and screen copy under `auth/`. That set is not independent of the rubric; read its limits in "Measured before and after". Four fixtures miss on the real key, always by one level: three are rated one level too low (two branch tests on `medium`, one file-deletion test on `high`) and one, the Java DTO mapper, one level too high (`medium` instead of `low`). Those four are recorded as known gaps and run as expected failures instead of being hidden by widening their accepted sets (see "Known gaps" and "Known gaps run as expected failures").

### Why the old sentence piled cases into medium

`extraction-v11` said: `critical` for payments, authentication, authorization or destructive actions; `high` for core business flows; `medium` for standard functional behavior; `low` for cosmetic or purely informational checks.

- **`medium` matched every test.** Every unit test verifies "standard functional behavior", so it was the one definition that always applied.
- **`critical` and `high` needed product knowledge.** "Core business flows" cannot be recognized from one test file, and the model sees nothing else.
- **`low` needed the word "cosmetic".** To the model, a formatting helper or a CSS-class assertion is functional code, so it went to `medium` as well.

The baseline showed the error at both ends. Presentation-only tests were inflated to `medium`, and the main test of a tiered calculation was deflated to `medium`.

### The rubric

The model rates each test by what the test asserts, not by the feature or folder it belongs to. It checks four rules in order and takes the first one that matches. Each earlier rule names what it does not cover and which later rule does, so the overlaps found in review (interface text versus outcome messages, dates under `high` versus display formatting under `low`) resolve one way. That the model always follows the order is not claimed; see "Known gaps".

| Order | Level | What the rule covers | What it hands on |
|---|---|---|---|
| 1 | `critical` | If the behavior is wrong, it can cause harm that cannot be undone, or a security breach: it removes or overwrites stored data, moves money, decides who can sign in or what someone may access, or exposes secrets or personal data to someone who should not see them. | — |
| 2 | `high` | The behavior produces a result or a state that other code relies on, and a wrong answer would not be noticed right away: a computation with several cases or boundaries, a result combined from many records, a change of state or the rule that refuses one, a rule that keeps stored data consistent. A short test with test doubles qualifies. | Checking one input value on its own goes to `medium`; formatting a value for display goes to `low`. |
| 3 | `low` | The test checks how something looks or reads, or code that makes no decision: layout, styling, icons, fixed text, formatting a value for display (dates, numbers and amounts included), a render with fixed input, or a getter, constant, default or function that only passes or copies values. | A message that reports the outcome of an operation goes to `medium`. |
| 4 | `medium` | Any other single behavior whose failure is visible and recoverable: checking an input value and reporting the error, the message shown after an operation succeeds or fails, a simple successful path, reading data without changing it. | — |

The file path only settles a choice between two adjacent levels when the test body supports both. It never sets a level on its own.

| Decision | Why |
|---|---|
| `medium` is no longer the default for logic-bearing tests | Every level has a positive trigger, but rule 4 still hands `medium` any other single behavior whose failure is visible and recoverable, so a single behavior that matches no other rule lands there. What changed is that `medium` is no longer where a test goes just because it checks "standard functional behavior": in the rubric's order a computation, a state change or a refusal is claimed by rule 2 first, although the model does not always follow that order (see "Known gaps"). The first hypothesis, making `high` the fallback, would only move the pile: the baseline errors sat at both ends, and no single default fixes both. |
| `low` is checked before `medium` | A presentation-only test has to be claimed before the last rule can absorb it. |
| Explicit hand-offs | Earlier drafts listed "dates" under `high` and "interface copy" under `low`, so a date formatter or an error message matched two rules. Each rule now states the cases it passes to a later one. Unit tests pin that the exclusions sit inside the earlier rule and that the `high` rule no longer mentions dates. |
| Judged by what the test asserts | A test that only checks the text of a sign-in button is about text, not about sign-in. The held-out fixture for this case stayed `low` in both runs. |
| Same behavior, same level | The rubric asks for one level across every test of the same behavior, including refusals, side effects and edge cases. The model did not follow this reliably; see "Known gaps". |
| An ordered checklist | `gemini-3.1-flash-lite` defaults to the `minimal` thinking level, and the extractor sets no `thinkingConfig`. A first-match lookup suits a model that does little reasoning before it answers. |
| No few-shot block | Gemini's guidance warns that too many examples cause overfitting, and examples close to the fixtures would make the measurement circular. |
| Generic vocabulary | The rubric names kinds of behavior, not domains, identifiers or folders. A unit test fails if the rubric mentions any identifier, domain or folder used by the design fixtures, or the words "Qably" or "Aeris". |

### Field limits in the prompt

Both locales state these case field limits as numbers, in one sentence:

| Field | Limit stated |
|---|---|
| `title` | up to 120 characters |
| `objective`, `expectedResult` | up to 500 characters |
| `preconditions` | at most 10 items of up to 300 characters |
| `steps` | 1 to 20 items of up to 300 characters |
| `sourceExcerpt` | up to 600 characters |
| `observations` | at most 5 items of up to 200 characters |

- The numbers are rendered from `CASE_LIMITS` in `extraction.contracts.ts` (now exported), the object the Zod case schema uses. Changing a constant changes the prompt and the validator together, and the unit tests pin the rendered numbers.
- The suite limits (80, 300 and 20) come from the new `SUITE_LIMITS`, which both suite schemas use. `suite-summary-prompt.ts` reads the same constants; its rendered text is byte-identical to before, so `suite-summary-v1` did not change. Validation behavior is unchanged: the existing contract tests for 81, 301 and 41 characters still pass.
- The observations sentence no longer spells out "five": the count appears once, in the limits sentence. `ExtractionProcessor` also reads its observation cap (the point where it stops appending an incomplete-extraction note) from `CASE_LIMITS.observations` instead of its own literal 5, and its suite tag cap (`SUITE_TAG_CAP`) from `SUITE_LIMITS.tags` instead of its own literal 20; neither value changed.
- `sourceExcerpt` keeps its original wording, "a short, literal quote of the lines in the file that justify the case", plus the number. A "contiguous, never the whole test" wording was tried and dropped, because it was never measured on its own.
- Zod still repairs anything longer (see "Fields over the limit: repaired, not dropped"). Whether stating the numbers reduces the number of repairs has not been measured.
- The 20-case cap stays in the targeted path only. There, `enqueueDocumentFiles` already chunks the target list to at most 20, so the stated cap matches the list. The untargeted path asks for one entry per declaration, and so does the declaration-count retry hint. Adding "at most 20" there would contradict both and let the model choose which cases to drop, including the one a document-case job is looking for. The cap stays enforced in code by `GeminiExtractor.toOutcome`.
- `RESPONSE_JSON_SCHEMA` and `TARGETED_RESPONSE_JSON_SCHEMA` did not change and still carry no bounds.
- Cost: the untargeted system instruction grows from 4,760 to 7,088 characters in Spanish and from 4,480 to 6,628 in English. Targeted calls grow by the same amount. Token counts were not measured.

### Measured before and after

All fixtures are synthetic test files in `gemini.extractor.integration.spec.ts`, none taken from the repository. Their locales alternate so both prompt variants run. Every run used the real key, the model set by `GEMINI_MODEL` for the API (default `gemini-3.1-flash-lite`) and temperature 0.2, as in production. Each column is a single run, so every result is one sample of a nondeterministic model.

**Read the design set as circular.** The seven design fixtures informed the rubric: their failures drove the first draft. A later version was also tuned on them (a `critical` phrase added to fix one fixture, then removed as fixture-specific). They show that the rubric is followed, not that it generalizes.

**Read the held-out set as partly post-hoc.** Six held-out fixtures were written after the first draft and first run against it (the "v12 draft" column). Three of their misses (stock reservation, idempotency, mapper) then informed the generic rewrite, so for those three the later columns are post-hoc. Activity aggregation and not-found response were reported as written before the final run and never used for tuning, but the rubric's phrases "a result combined from many records" and "reading data without changing it" match them closely, so treat them as weak evidence too.

**Read the blind set as a check against surface-level overfitting only.** Six fixtures were written in a third pass, after the rubric text was frozen, by a writer who had not seen any earlier run. They use Python, Java and Kotlin, which no rubric draft was tested on, and two of them sit under paths that invite over-rating (`billing/`, `auth/`). The rubric was not changed after they ran. That is where their independence ends:

- Each blind fixture instantiates a clause of the rubric, and each has a paired earlier fixture that exercises the same clause.
- The rubric's own vocabulary ("refuses", "copies", "labels", "dates", "many records", "reading without changing") came from the held-out set.

| Blind fixture | Paired earlier fixture |
|---|---|
| Amount formatting under `tests/billing/` | Formatting helper and date formatting helper |
| Ticket lifecycle | State transition rule (order status) |
| Screen copy under an `auth` package | Button text under an auth path (login) |
| Rerunnable data migration | Idempotency key |
| Failure message after an export | Error message after a failed save (settings) |
| Field-copying DTO mapper | Pass-through mapper (to-user-summary) |

So the blind set can show that the rubric does not depend on a language, on identifiers or on folder names. It cannot show that the rubric handles behaviors unlike the ones that shaped it. Both blind columns are the same prompt text: "before" is the frozen draft run on its own, "after" is the full spec run that closed the pass.

Blind set, 6 fixtures (n = 11 cases per run):

| Fixture | Language, locale | Accepted | Before | After |
|---|---|---|---|---|
| Amount formatting under `tests/billing/` | Python, es | low | low, low | low, low |
| Ticket lifecycle (state transition) | Java, en | high | high, high | high, high |
| Screen copy under an `auth` package | Kotlin, es | low, medium | low, low | low, low |
| Rerunnable data migration | Python, en | high, critical | high, high | high, high |
| Failure message after an export | Python, es | medium | medium, medium | medium, medium |
| Field-copying DTO mapper | Java, en | low | medium | medium |

Held-out set, 8 fixtures (n = 11 cases in the draft run, 15 in the later runs). "Pass 3 before" and "pass 3 after" are the frozen text of this pass, run twice:

| Fixture | Locale | Accepted | v12 draft | Pass 2 final | Pass 3 before | Pass 3 after |
|---|---|---|---|---|---|---|
| Stock reservation | en | high | high, medium | high, medium | high, medium | high, medium |
| Button text under an auth path | es | low, medium | low, low | low, low | low, low | low, low |
| Date formatting helper | en | low | low, low | low, low | low, low | low, low |
| Error message after a failed save | es | medium | medium, medium | medium, medium | medium, medium | medium, medium |
| Idempotency key | en | high, critical | high, medium | high, medium | high, medium | high, medium |
| Pass-through mapper | es | low | medium | low | low | low |
| Activity aggregation | es | high | not run | high, high | high, high | high, high |
| Not-found response | en | medium | not run | medium, medium | medium, medium | medium, medium |

Design set, 7 fixtures (n = 14 cases per run):

| Fixture | Locale | Accepted | v11 run 1 | v11 run 2 | v12 draft | Pass 2 final | Pass 3 |
|---|---|---|---|---|---|---|---|
| Formatting helper | es | low | timeout | medium, medium | low, low | low, low | low, low |
| Cosmetic rendering | en | low | medium, medium | medium, medium | low, low | low, low | low, low |
| Input validation | es | medium | medium, medium | medium, medium | medium, medium | medium, medium | medium, medium |
| Tiered calculation | en | high, critical | medium, high | medium, high | high, high | high, high | high, high |
| State transition rule | es | high, critical | high, high | high, high | high, high | high, high | high, high |
| Permission decision | en | critical, high | high, high | critical, critical | critical, critical | high, high | high, high |
| Destructive operation | es | critical | critical, high | critical, high | critical, critical | critical, high | critical, high |

| Cases per level | n | low | medium | high | critical | In accepted set |
|---|---|---|---|---|---|---|
| Design, v11 run 2 | 14 | 0 | 7 | 4 | 3 | 8 |
| Design, pass 3 | 14 | 4 | 2 | 7 | 1 | 13 |
| Held-out, v12 draft | 11 | 4 | 5 | 2 | 0 | 8 |
| Held-out, pass 3 (each run) | 15 | 5 | 6 | 4 | 0 | 13 |
| Blind, pass 3 (each run) | 11 | 4 | 3 | 4 | 0 | 10 |

- "v12 draft" is the rubric of the first pass: domain examples, path segment lists and "or any part of one". "Pass 2 final" and every "pass 3" column are the generic text now in the code. All are `extraction-v12`: the draft never shipped.
- The v11, draft and pass 2 columns come from earlier passes and were not rerun in pass 3; the pass 3 columns were.
- In v11 run 1 the formatting call hit the 60-second SDK timeout, so that run returned 12 cases.
- No over-critical rating appeared in any set: the only `critical` is the purge test of the destructive fixture. A formatter under `billing/` and screen copy under two `auth` paths all stayed `low`.
- Every miss is one level off, in both directions. Three are too low: two branch tests (the stock refusal and the different-keys test) rated `medium` instead of `high`, and the file-deletion test rated `high` instead of `critical`. One is too high: the Java DTO mapper rated `medium` instead of `low`. Three of the four misses land on `medium`. The TypeScript mapper, with the same shape as the DTO mapper, was `low`.
- The two pass 3 runs of the held-out and blind sets returned identical levels, case by case. Two runs at temperature 0.2 give no estimate of variance, so that agreement does not show that a miss is systematic or that a pass is reliable. Judging a fixture takes at least three runs.
- The design set puts 7 of 14 cases in `high`, exactly the half its distribution assertion allows.
- Provider calls: 37 in the first pass, 30 in the second (both as reported by those passes), and 42 in the third (14 for the held-out and blind sets on the frozen text, 28 for the full spec run).

**Exact and widened accepted sets.** Fourteen fixtures accept one level. Design: formatting helper, cosmetic rendering, input validation, destructive operation. Held-out: stock reservation, date formatting helper, error message, activity aggregation, not-found response, pass-through mapper. Blind: amount formatting, ticket lifecycle, failure message, DTO mapper. Each pins a behavior the complaint or the review is about, and widening one after it failed would hide the move the check exists to catch. Seven fixtures accept two adjacent levels because both are defensible: tiered calculation, state transition rule, permission decision, button text under an auth path, idempotency key, screen copy under an auth package and rerunnable data migration.

In pass 3 four fixture checks failed, each time by one level: three exact-level fixtures (destructive operation and stock reservation too low, the DTO mapper too high) and the idempotency key, whose `medium` falls outside its two-level set (too low). Stock reservation, the DTO mapper and the idempotency key failed identically in both runs; destructive operation ran only in the full run. The spec marks those four as known gaps instead of widening their sets or leaving the spec red (see "Known gaps run as expected failures").

The wide sets also hide something. A two-level set passes whichever of the two levels the model picks, so it cannot show which rule the model applied; see the first row of "Known gaps".

**What this shows, and what it does not.** On surface-different inputs, the rubric spreads cases across `low`, `medium` and `high`, and rated `critical` only the purge test of the destructive fixture. It still under-rates branch tests and over-rates one kind of mapper, each by one level. The evidence is small: 11 blind cases, a single prompt text, temperature 0.2, two runs that agreed, and blind fixtures paired with earlier ones (see the pairing table above). It does not show that the rubric generalizes to unlike behaviors, and it is not proof for any codebase.

### What the version bump triggers

Nothing beyond the audit stamp. `EXTRACTION_PROMPT_VERSION` has one reader, `ExtractedProposalWriter`, which writes it to `ExtractedProposal.promptVersion` when it creates or refreshes a proposal. No query filters by that column, no job compares versions, and the web does not read it. Re-documentation (`mode: 'stale-locale'`) compares `TestCaseVersion.locale`, not the prompt version. The bump enqueues no job, marks nothing stale and spends no credits.

- New proposals carry `extraction-v12`. An in-review proposal refreshed by a redelivered code-change job also moves to `extraction-v12` with the rest of its fields; that job runs for its own reasons, never because of the bump.
- Existing proposals and published cases keep the priority `extraction-v11` gave them.

### Known gaps

Four fixtures fail on the real key. Each carries `knownGap: true` in the integration spec with its accepted set unchanged (see "Known gaps run as expected failures").

| Fixture | Set | Accepted | Rated | Direction |
|---|---|---|---|---|
| Destructive operation | Design | `critical` | `high` (file-deletion test) | One level too low |
| Stock reservation | Held-out | `high` | `medium` (refusal test) | One level too low |
| Idempotency key | Held-out | `high`, `critical` | `medium` (different-keys test) | One level too low |
| Field-copying DTO mapper | Blind | `low` | `medium` | One level too high |

| Gap | Status |
|---|---|
| The wide accepted sets hide an unresolved ambiguity between rules 1 and 2 | Rule 1 comes first, so a test that meets it literally should be `critical`. But rule 2 ("a change of state or the rule that refuses one", "a rule that keeps stored data consistent") describes nearly the same tests, and the model does not always apply the order. The permission decision fixture meets rule 1 literally (it decides what someone may access), yet it came out `high` in some runs; its accepted set, `critical` or `high`, passes both. A case that overwrites stored data passes either way too: the rerunnable data migration accepts `high` and `critical`. A green result on those fixtures therefore does not say which rule the model applied. Resolving it needs exact-level fixtures on each side of the overlap, run at least three times each. |
| Branch tests rated one level low | In every pass 3 run of the current text, the refusal test of the stock reservation and the different-keys test of the idempotency fixture got `medium`, and the file-deletion test of the account deletion got `high`. Three later reruns of those fixtures (one call each per run) repeated the stock refusal on `medium` and the file deletion on `high` every time, but rated the different-keys test `high` in two of the three. The "same behavior, same level" sentence did not fix it. The next attempt should be measured on its own, with at least three runs per fixture and a fresh blind set, since the current blind set has now been seen. |
| A field-copying mapper rated `medium` (one level too high) | The blind Java DTO mapper (three `assertEquals` on copied fields) got `medium` in both runs, while the TypeScript mapper with one `toEqual` got `low`. In three later reruns it got `medium` twice and `low` once. Not tuned: changing the rubric after this result would turn the blind fixture into a design fixture. |
| The existing corpus is not reclassified | Future work. Reclassifying needs a deliberate, budgeted job at one credit per file; nothing in this change starts one. |
| The chat prompt keeps an older copy of the rubric | `apps/api/src/modules/chat/chat-prompt.ts` (Spanish and English) still says `medium` for standard behavior, so chat suggestions keep the old bias. Changing it needs its own `CHAT_PROMPT_VERSION` bump and a real-key run. |
| Wording that may cause the misses (unmeasured hypothesis) | UNMEASURED. Three phrases could pull a test to the wrong level: "a simple successful path" and "checking an input value and reporting the error" in rule 4 fit the different-keys test, the stock refusal and the DTO mapper, all three rated `medium`; "stored data" in rule 1 may not read as covering stored files, which would explain the file-deletion test on `high`. No run has varied any of this wording, so it is a guess about cause, not a finding. Testing it means changing one phrase at a time, with at least three runs per fixture. |
| Missing fixtures | No fixture covers ordinary persistence (saving or updating a record with no overwrite risk and no consistency rule), which rule 1 ("overwrites stored data"), rule 2 and rule 4 could each be read to claim. No fixture covers the file-path clause either: nothing puts a test body that supports two adjacent levels under a path that favors one of them, so "the file path only settles a choice between two adjacent levels" is untested. The `billing/` and `auth/` fixtures only show that a path did not raise a level. |
| Temperature 0.2 | Gemini 3 guidance recommends the default temperature of 1.0 and warns that low values can cause looping or degraded output. Not changed here: it affects every field and needs its own measurement, as a separate future A/B of the same fixtures at 1.0 against 0.2, at least three runs each. |
| Thinking level | Left at the model default (`minimal` on Flash-Lite). A higher level could help borderline cases at a latency and token cost; not measured. |
| Real proposals | The next check is the level distribution of real `extraction-v12` proposals in the review inbox. |

### Sources

Checked through context7 on 2026-09-28 (`/websites/ai_google_dev_gemini-api`, `/googleapis/js-genai`). The installed SDK is `@google/genai` 2.21.0.

| Fact | Source |
|---|---|
| Gemini 3.1 Flash-Lite supports the `minimal` (default), `low`, `medium` and `high` thinking levels. | ai.google.dev/gemini-api/docs/generate-content/whats-new-gemini-3.5 |
| Gemini 3 models work best with direct, well-structured prompts with clear tasks and constraints; verbose prompt engineering can cause over-analysis. | ai.google.dev/gemini-api/docs/prompting-strategies; whats-new-gemini-3.5 |
| Gemini detects patterns from a few examples, and too many examples risk overfitting the response to them. | ai.google.dev/gemini-api/docs/prompting-intro ("Optimal number of examples") |
| Structured output supports a subset of JSON Schema, and very large or deeply nested schemas may be rejected. | ai.google.dev/gemini-api/docs/structured-output; json-mode |
| Structured output is syntactically valid JSON but can be semantically wrong, so the application must validate the values. | ai.google.dev/gemini-api/docs/structured-output ("Best practices") |
| Changing temperature, top_p or top_k is no longer recommended for Gemini 3.x; the default temperature of 1.0 is recommended, and low values risk looping or degraded performance. | ai.google.dev/gemini-api/docs/gemini-3; whats-new-gemini-3.5 |
| `systemInstruction`, `responseMimeType`, `responseJsonSchema` and `thinkingConfig.thinkingLevel` are `generateContent` config fields in the JS SDK. | github.com/googleapis/js-genai, codegen_instructions.md |

The documentation lists `minItems` and `maxItems` as supported array keywords. The 2026-09-26 incident in "Limits" shows that a supported bound can still push a schema past the serving state limit, so the project rule stands: the provider schema carries no bounds.

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

That makes it unpublishable by definition, and the API enforces it: `ReviewDecisionService.approve` returns `incomplete-proposal` (HTTP 422) for any proposal whose `steps` are empty, before any transaction opens. Without that guard, approving a fallback published an `active` official case with zero steps — documented intent with no content — which is exactly what human review is supposed to prevent. The invariant is stated on the content, not on the flag: nothing publishes an official case with no steps, whatever produced it.

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

The retry hint follows the mode of the call. Without targets, the appended sentence keeps the one-entry-per-declaration rule ("return one entry for each"). With a `<<<TARGET_CASES>>>` block, that rule is already replaced by the targets-only rule, and the file-wide count is not the number of targets, so `buildSystemInstruction` renders a different sentence: it still states the count as evidence that the file has tests, but asks for one entry per line of the target block whose test is in the file and to ignore the other declarations. The processor passes the same file-wide count in both modes; the mode decision lives only in the prompt builder, so a targeted retry never contradicts the targets rule.

When the retry (or the first call) returns fewer cases than the count, extraction did not fail but it likely did not finish — `ExtractionProcessor.applyIncompleteExtractionNote` appends an observation naming both numbers (`"Aeris extracted 2 of 5 test declarations found in this file."`) onto every case in that batch, using the same `observations` mechanism the model's own advisory notes use, so the discrepancy is visible on the proposal instead of silently passing as a complete extraction.

An `extraction-incomplete` fallback proposal is not a dead end in the review inbox: `ReviewProposalInspector` reads `targetOfficialTestCaseId`/`targetOfficialTestCaseSuiteId` — the review list now selects `targetTestCase.suiteId` alongside the existing `targetTestCaseId`, so the client knows which suite the case lives in without a second request — and, when both are present, offers a "Document again with Aeris" action that calls the same `POST /suites/:id/cases/:caseId/document` endpoint the case card's own "Document again with Aeris" row action uses (`enqueueDocumentCase`, above). The action is scoped to `extraction-incomplete` specifically: a plain `no-tests-found` fallback has nothing to retry.

## File-level documentation

A repository connected for the first time arrives with every automated case already created by CI and none of them documented. Asking a reviewer to press a per-case button several hundred times is not a workflow, and it bills a model call per case for work the model does per file anyway: the extractor reads a whole test file and can return up to `MAX_EXTRACTED_CASES` cases from that one call.

The `document-file` job kind is that unit. `ExtractionService.enqueueDocumentFiles` collects the automated cases in a suite or project that have no steps and no proposal already in review, groups them by resolved `automationFilePath`, and enqueues one job per file carrying the list of `automationKey`s to fill. `POST /suites/:id/document` and `POST /projects/:id/document` expose it, both behind `AiEntitlementGuard` and a throttle, and both answer with `filesEnqueued`, `casesTargeted` and a `casesSkipped` breakdown so the caller can see what was left out and why rather than assuming everything was queued.

The processor matches each returned case to a target by `automationKey`, the same join key run ingestion uses, and writes one `ExtractedProposal` per matched target. A target the model never returned gets its own `automation-key-not-found` fallback: a case that could not be documented is visible in the review inbox, never a silent omission.

Since `extraction-v9`, a `document-file` job's prompt tells the model to extract only the declarations named in its `TARGET_CASES` block and ignore every other test declaration in the file; the older "one entry per declaration" instruction — still the rule for a code-change or document-case job, which never carries a target list — no longer applies once targets are present. This removes the previous conflict between that blanket instruction and the `MAX_EXTRACTED_CASES` cap — enforced in `GeminiExtractor.toOutcome`, not in the provider schema — on a file with more declarations than a single chunk's targets.

One request enqueues at most `MAX_DOCUMENT_FILES_PER_REQUEST` files. A first connection can bring thousands of undocumented cases across hundreds of files, and without a ceiling a single click would commit that many provider calls before anyone could see the bill. The response reports what was actually queued, and the action stays available while cases remain, so the rest is queued by pressing again — a bounded commitment repeated deliberately, rather than one unbounded one.

The job id is `document-file:<projectId>:<filePath>:<chunkIndex>`. The project id is not decoration: two organizations routinely hold a file at the same relative path, and an id built from the path alone would let BullMQ deduplicate one organization's job against another's, leaving the second silently unprocessed while its HTTP response claimed success. Scoping it also makes a repeated identical request idempotent instead of doubling the work.

Writing the proposals takes a row lock (`SELECT ... FOR UPDATE`, ordered by id) on the target cases at the top of the transaction. `ExtractedProposal` has no unique constraint on `targetTestCaseId`, so the check-then-create that precedes each write is not atomic on its own: a chunk redelivered after the worker lock expires could pass the pending check concurrently with the original and write a second proposal for the same case, spending a second credit for one chunk. The lock makes the second writer wait and then observe what the first wrote. Ordering the ids keeps two chunks with overlapping targets from deadlocking against each other.

### Chunking, and why the 20-case cap stays

`MAX_EXTRACTED_CASES` bounds one model response, enforced in code (`GeminiExtractor.toOutcome`) rather than in the provider schema — see "Limits" above. Raising it to cover a large file would widen the blast radius of a single call against the existing output-token ceiling, for a problem chunking already solves. A file with more target cases than the cap becomes several `document-file` jobs over the same file, each carrying its own slice of the target keys and each a separate model call.

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

Tags are unioned, not replaced: `mergeSuiteTags` keeps every existing tag and appends newly proposed tags not already present, capped at `SUITE_LIMITS.tags` (20) in total (`SUITE_TAG_CAP`) so the list cannot grow without bound across repeated runs. A human-added tag Aeris never proposed is never dropped.

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

### Queue retry backoff

`EXTRACTION_QUEUE` jobs get `attempts: 3` with a 30s exponential backoff (`review.module.ts`). A shorter delay (2s was tried first) does not survive a per-minute provider rate limit — the most common retryable failure, e.g. the Gemini free tier — because the SDK itself already retries transient errors three times within seconds before giving up. A job-level retry only helps if it waits meaningfully longer, so 30s exponential gives attempts at roughly 30s and 60s after the first failure.

### Attempt tracking on the job context

`JobContext`/`DocumentFileJobContext` (`extraction.types.ts`) carry `isFinalAttempt` and `isFirstAttempt`. `isFinalAttempt` is true once BullMQ won't retry the job again after this run, which is what lets the fallback path decide between rethrowing a `RetryableProviderError` (more attempts remain) and writing the manual-review fallback (this was the last one). `isFirstAttempt` is true only on the job's very first execution; a retry means the daily AI budget was already spent once for this logical extraction, so budget checks only charge on the first attempt.

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

`apps/api/src/modules/ai/gemini.extractor.integration.spec.ts` calls the real Gemini API against all three prompts this module and the chat module send — `extraction-v12` (`GeminiExtractor.extract`), `suite-summary-v1` (`GeminiExtractor.summarizeSuite`) and `chat-v5` (`GeminiChatAssistant.reply`) — with tiny synthetic fixtures written for the test (never real customer code), and asserts each response matches its Zod schema (`extractionOutputSchema`, `suiteSummarySchema`, `suggestedCasesSchema`). It never asserts exact wording, since model output is not deterministic. Run it after any change to a response schema or a prompt: it is the only check in the repository that validates schema acceptance against the real model, and the unit suite (which mocks the client) cannot catch a provider-side rejection like the 2026-09-26 incident described in "Limits" above.

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

The file has six `describe` blocks: `GeminiExtractor (manual integration, real API)`, three priority blocks (`GeminiExtractor priority rubric, design fixtures`, `... held-out fixtures` and `... blind fixtures`, each suffixed `(manual integration, real API)`), `GeminiExtractor.summarizeSuite (manual integration, real API)` and `GeminiChatAssistant (manual integration, real API)`. The schema, suite summary and chat blocks must be green. The priority blocks are a measurement: four of their fixtures are known gaps (three rated one level too low, one too high, as recorded in "Priority rubric (extraction-v12)"). They run as expected failures, so a run in the current state is green, and a change to the rubric should be judged against the tables there and not only against a green run (see "Known gaps run as expected failures"). Without the key, the same command reports every test in the file as skipped, never failed — that is the expected state for every CI run and for a local run with nothing exported.

A full run makes 28 provider calls: five extraction checks, seven design fixtures, eight held-out fixtures, six blind fixtures, one suite summary and one chat reply. Each priority set rates a fixture the first time a test needs it and keeps the result for the rest of the run: the per-fixture tests each make one provider call, in sequence, and the distribution test reuses those results and rates only the fixtures nobody has asked for yet. No test depends on another having run first, and a fixture that no selected test needs makes no call. The priority blocks assert acceptable sets of levels rather than exact values, and print the level and automation key of every case, so the distribution can be compared with the tables in "Priority rubric (extraction-v12)".

- Run one set with `-t "design fixtures"` (7 calls), `-t "held-out fixtures"` (8 calls) or `-t "blind fixtures"` (6 calls); `-t` takes a regular expression, so `-t "held-out fixtures|blind fixtures"` runs two sets.
- Run the four known-gap fixtures alone with `-t "known gap"` (4 calls).
- A single fixture can be rerun alone: `-t "stock reservation"` rates only that fixture, in one call.
- Model output is nondeterministic, so go by the majority of reruns before changing the prompt.
- Every real-key test allows 120 seconds. A 30-second jest limit sat below the SDK's own 60-second request timeout and failed the tiny-fixture test on a slow provider response. The third-pass full run finished in 177 seconds overall with no timeout.

Jest does not load `.env` on its own, but preloading `dotenv` for one command does the same as exporting the key, without printing it: `NODE_OPTIONS="-r dotenv/config" npx jest --maxWorkers=2 gemini.extractor.integration`, from `apps/api`.

### Known gaps run as expected failures

A fixture that misses its accepted set is marked `knownGap: true` in `gemini.extractor.integration.spec.ts` and runs through `it.failing.each` (Jest 30) with its accepted set unchanged. Today those are destructive operation, stock reservation, idempotency key and the field-copying DTO mapper.

| What happens on the real key | Result |
|---|---|
| The gap is still there | Green: the test fails as expected. |
| A fixture that is not a known gap leaves its accepted set | Red, as a regression. |
| A known-gap fixture now lands inside its accepted set | Red: "Failing test passed even though it was supposed to fail". Remove `knownGap` so the fixture becomes a normal test. |

- Widening the accepted set was rejected: it would turn a recorded miss into a pass.
- Leaving the spec red was rejected: a permanent red hides a new regression among the four known ones.
- Each known-gap fixture also has a plain test, named with "(known gap)", that only checks the provider returned rated cases. Without it, a timeout or a provider error on that fixture would count as an expected failure and pass unnoticed.
- Output is nondeterministic, so a red on a known-gap fixture may be one lucky run. Rerun before removing the flag, and promote the fixture only when it holds over at least three runs.
- This already happened when the flag was added. Three reruns of the four fixtures on 2026-09-28: destructive operation and stock reservation missed every time; the idempotency key landed inside its set in two of three runs; the DTO mapper landed on `low` in one of three. Until more runs settle those two, expect the spec to turn red now and then on them without any change to the rubric.
- Without `GEMINI_API_KEY` the whole file is skipped, known-gap tests included.
