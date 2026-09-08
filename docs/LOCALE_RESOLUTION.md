# Locale resolution

The AI (chat replies, extraction proposals) and notifications need to know which language to answer in. This document is the single source of truth for how that language is chosen, replacing three constants that used to disagree with each other (`@qably/i18n`'s `DEFAULT_LOCALE` was `'en'`, `chat.service.ts` defaulted to `'es'`, `extraction.processor.ts` defaulted to `'es'`).

## Resolution chain

Highest priority first:

1. **Explicit persisted user preference** — `User.locale`, set only through `PATCH /me`.
2. **Organization default** — the earliest-joined `owner` member's `User.locale`.
3. **`Accept-Language`** (BCP 47) from the incoming request.
4. **System default** — `DEFAULT_LOCALE` from `@qably/i18n`.

`resolveLocale(...candidates)` (`packages/i18n/src/index.ts`) implements this generically: it returns the first candidate whose BCP 47 primary subtag is a supported locale, trying each candidate in priority order, and falls back to `DEFAULT_LOCALE` when none match. `parseAcceptLanguage(header)` expands a raw `Accept-Language` header into an ordered list of tags, respecting `q` values.

The rule that matters most: **the locale follows the recipient of the output, not the owner of the resource.** A code-change proposal is read by whoever reviews it, not by whoever pushed the commit; a notification email is read by its recipient, not by the organization's owner.

## Why `User.locale` is nullable

`User.locale` used to be `String @default("en")`. Nothing in the codebase ever wrote to that column — the language switcher persisted only to the browser (`zustand` + `localStorage`). Every existing row's `"en"` is therefore Prisma's column default, never a user's actual choice, and it is provably safe to treat every existing row as "no preference recorded": that is exactly the state that `NULL` should represent going forward. The migration that made the column nullable (`apps/api/prisma/migrations/*_make_user_locale_nullable`) also reset every existing row to `NULL` for this reason.

## Queued jobs resolve locale at enqueue time, not at run time

Extraction jobs (`ExtractionProcessor`) run later, without an HTTP request, and their output (a proposal) is persisted for a human to read afterward. Resolving the locale when the job *runs* would have no `Accept-Language` header and no request-scoped user context to fall back on. Instead, `ExtractionService` resolves the locale once, at enqueue time, and carries it in `ExtractionJobData.locale` — the same pattern as Laravel's `Queueable::$locale` or Rails ActiveJob serializing `I18n.locale`.

- `enqueueDocumentCase` has an acting user (a reviewer clicked "document this case"): resolve `actor locale -> organization default -> DEFAULT_LOCALE`.
- `enqueueCodeChanges` is webhook-triggered and has no acting user: resolve the organization default directly (`organization default -> DEFAULT_LOCALE`).

`ExtractionProcessor` reads `job.data.locale` directly. Jobs enqueued before this change (or redelivered from before a deploy) may not carry a `locale` field at all; `resolveLocale(job.data.locale)` handles that by falling back to `DEFAULT_LOCALE`, so no separate migration of in-flight jobs is needed.

## Web hydration order

`I18nProvider` (`apps/web/src/lib/i18n/i18n-provider.tsx`) sets the UI locale in this order, without blocking first paint on any network call:

1. Rehydrate the persisted `localStorage` choice (or detect the browser's `navigator.languages` if nothing was ever stored).
2. In the background, fetch `GET /me`. If it returns a non-null `locale`, that overrides whatever step 1 produced — the server-persisted preference always wins once it arrives.

`GET /me` fails (401) for a signed-out visitor, which is expected and silently ignored: local/browser detection is the correct answer for someone who has never had a chance to set a server-side preference.

## Notifications: per-recipient vs. per-organization

`NotificationsProcessor.notify()` sends one message per human recipient, so it always uses that recipient's own resolved locale — never a shared default.

`NotificationsProcessor.notifyWebhooks()` is different: a Slack or Discord webhook has no single human recipient, so there is no per-recipient locale to resolve. It uses the organization default instead (the same "earliest-joined owner" resolution used by `enqueueCodeChanges`).
