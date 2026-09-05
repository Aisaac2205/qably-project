# API Access Logs

The API writes one log line per HTTP response so production traffic can be read from the deploy logs without attaching a debugger or a third-party APM.

## Where it lives

- `apps/api/src/common/http/access-log.middleware.ts` builds the entry and decides the level.
- `apps/api/src/main.ts` registers it as the first Express middleware, before body parsing, so the measured duration covers the whole request.

## What each line contains

| Field | Meaning |
| --- | --- |
| `time` | ISO-8601 timestamp of the response. |
| `level` | `info` for 2xx and 3xx, `warn` for 4xx, `error` for 5xx. |
| `method` | HTTP method. |
| `route` | The matched route template, for example `/runs/:id`. Unmatched requests (404) fall back to the raw path. |
| `status` | HTTP status code. |
| `durationMs` | Wall-clock time from middleware entry to response finish, rounded to one decimal. |
| `requestId` | Value of `x-request-id`. An incoming header is reused when it matches `[A-Za-z0-9._-]{1,128}`; otherwise a UUID is generated. The same value is echoed back on the response. |

In production (`NODE_ENV=production`) every line is a single JSON object, which Railway indexes as structured attributes. In any other environment the line is human readable: `GET /projects 200 4.2ms <requestId>`.

## What is never logged

- Headers, including `Authorization` and cookies.
- Request or response bodies.
- Query strings. Magic-link and webhook flows carry secrets there.
- Raw path parameters when a route matched. The template is logged instead of the id.

## Excluded traffic

Requests whose path starts with `/health` are not logged. Railway polls that endpoint continuously and the lines would drown real traffic.

## Reading production traffic

Filter the Railway deploy logs with structured attributes, for example:

```text
@status:>=500
@route:"/runs/ingest/junit"
@requestId:"<value from a client error report>"
```

A client that sends `x-request-id` can correlate its own error with the exact API line.
