# Qably API Keys — Programmatic Credentials for External Agents

Qably does not run tests. External agents (GitHub Actions, and later any CI runner) execute them and
**push** the results back. An API key is how such an agent proves who it is, since it has no browser
session and no user behind it.

This document explains the mechanism. It contains no real keys and no recoverable secret material:
every value shown is a placeholder.

## Why this exists

The thesis scope requires it explicitly:

- Activity 7 (§1.5.3): an authentication and access control module including the issuance of
  programmatic keys for external integrations.
- Scope item 6 (§1.6.1): programmatic keys for the integrations with the external agents that run the
  tests.
- Scope item 4 (§1.6.1): automatic result recording fed by those external agents.
- Limit 4 (§1.6.2): the platform never executes tests on its own servers — it orchestrates, records
  and updates results produced elsewhere.

Limit 4 is what makes the key necessary rather than optional. Because Qably receives instead of
polling, the inbound request is the trust boundary.

## Scope: one key, one project

A key belongs to a single project and authorizes exactly one capability: writing execution results
for that project. It cannot read projects, create suites, or touch the organization.

This follows the pattern every comparable platform converged on — the narrow credential is the
default, and a broader one is an opt-in with a documented warning:

| Platform     | Credential                 | Scope                                    |
| ------------ | -------------------------- | ---------------------------------------- |
| Cypress Cloud | Record key                | Per project                              |
| Codecov      | Upload token               | Per repository (org-wide token optional) |
| Vercel       | Access token               | Account, team, or single project         |
| Railway      | `RAILWAY_TOKEN`            | Project + environment, deploy only       |

The consequence that matters for correctness: **the project is derived from the key, never from the
request payload**. An ingestion endpoint that trusted a `projectId` in the body would let any holder
of any valid key write results into someone else's project, which would make the traceability chain
(specific objective 4) unverifiable.

## Token anatomy

```
qbly_<lookupId>_<secret>
 |        |          |
 |        |          `-- 32 random bytes, hex encoded (256 bits)
 |        `------------- 6 random bytes, hex encoded; public, indexed
 `---------------------- fixed platform prefix
```

Each part earns its place:

- **`qbly_` prefix** — makes a leaked key recognizable. This is what allows automated secret scanning
  to flag the credential if it is ever committed to a repository.
- **`lookupId`** — a public, unique, indexed identifier. Authentication resolves exactly one row
  instead of hashing the candidate against every key in the table.
- **`secret`** — the only part that proves possession. 256 bits of entropy from a CSPRNG.

The UI displays `prefix` (`qbly_<lookupId>`) plus the last four characters. That is enough to tell two
keys apart without ever showing the secret again.

## Storage: hashed, not encrypted

The stored column is `sha256(secret)`. Two decisions are deliberate here.

**Hashed, not encrypted.** Compare with `Connection.encryptedToken`, which holds SCM personal access
tokens under AES: those must be recovered in plaintext to call GitHub. A Qably API key is never
recovered — only compared. Encrypting it would create a master key whose compromise would expose
every customer credential, for no functional gain.

**SHA-256, not bcrypt or argon2.** Slow password hashes exist to protect low-entropy, human-chosen
secrets against dictionary attacks. This secret is 256 random bits: there is no dictionary and nothing
to slow down. Applying a deliberately slow hash on the hottest ingestion path would only turn
authentication into a denial-of-service vector. A fast hash over a high-entropy random token is the
correct construction, and is what GitHub and Stripe use for their own tokens.

Comparison uses `timingSafeEqual`, the same primitive already used for SCM webhook signatures.

## Lifecycle

**Issue** — `POST /projects/:projectId/api-keys` with `{ "name": "CI/CD Pipeline" }`. Requires a
session and the `owner` or `admin` role. The response is the only moment the plaintext token exists
outside the caller; it is never retrievable afterwards, including by the platform itself.

**Use** — the agent sends `Authorization: Bearer qbly_<lookupId>_<secret>`. The guard parses the
token, rejects a malformed one before touching the database, resolves the row by `lookupId`, rejects
a revoked key, and compares the hash in constant time. On success the request carries an identity of
`{ apiKeyId, projectId, organizationId }`.

**Observe** — `lastUsedAt` is recorded on first use and then at most every five minutes. Without the
throttle, a field that only informs the settings screen would cause a database write on every single
result an agent uploads.

**Revoke** — `POST /projects/:projectId/api-keys/:id/revoke` sets `revokedAt`. The row is never
deleted. Deleting it would destroy the record of which key wrote which run, which is precisely the
audit trail the platform exists to provide.

**Rotate** — a project may hold several active keys at once. Rotation is therefore issue, deploy,
revoke, with no window in which CI is locked out. A single-slot design would make every rotation an
outage, which in practice means rotation never happens.

## Using a key from GitHub Actions

The result ingestion endpoint ships in the next slice; this is the shape it is being built against.
Store the token as a repository secret and read it from the environment. Never inline it in the
workflow file.

```yaml
- name: Report results to Qably
  env:
    QABLY_API_KEY: ${{ secrets.QABLY_API_KEY }}
  run: |
    curl --fail --silent \
      --header "Authorization: Bearer $QABLY_API_KEY" \
      --header "Content-Type: application/json" \
      --data @results.json \
      https://api.qably.app/runs
```

The payload carries the commit SHA, the branch and the external run identifier. It does not carry the
project: that comes from the key.

## Threat model

| Threat                                | Mitigation                                                     |
| ------------------------------------- | -------------------------------------------------------------- |
| Key committed to a repository          | Recognizable prefix enables secret scanning; revoke and reissue |
| Database dump read by an attacker      | Only SHA-256 hashes are stored; no plaintext, no master key     |
| Stolen key used against other projects | Key is bound to one project; payload cannot override it         |
| Stolen key used to read or modify data | Key authorizes result ingestion only                            |
| Timing analysis of the comparison      | `timingSafeEqual` over fixed-length digests                     |
| Replayed or retried CI runs            | Idempotency on the external run identifier, with the ingestion endpoint |
| Key leaked in logs                     | The token is never logged, in success or in error paths         |

## Known gap

Long-lived secrets are the current state of the art for third-party SaaS ingestion, but not the
endpoint. GitHub Actions can mint short-lived OIDC tokens carrying verifiable claims about the
repository, ref and commit, which would remove the stored secret entirely. Today that federation is
practical against cloud providers rather than third-party services, so it is recorded here as future
work alongside the single-SCM-provider limit (§1.6.2, limit 2).
