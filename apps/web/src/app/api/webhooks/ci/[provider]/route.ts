/**
 * CI webhook route — `POST /api/webhooks/ci/[provider]`
 *
 * Receives a CI provider webhook (GitHub `check_run`, Bitbucket, GitLab),
 * normalizes it via the anti-corruption layer, and records the event in
 * the mock-store so the UI's `useConnections` reflects the new state.
 *
 * Next.js 16 contract:
 * - `params` is a Promise — MUST be awaited.
 * - The handler signature is `export async function POST(request, ctx)`.
 * - Body is read via `await request.text()` (raw) so HMAC verification
 *   sees the exact bytes the provider signed.
 *
 * Environment-gated verification (per demo recommendation #1000):
 * - In production: verify HMAC signature against `GITHUB_WEBHOOK_SECRET`
 *   (or provider equivalent). 401 on mismatch.
 * - In dev: skip verification. The "Simulate CI webhook" button posts
 *   raw payloads to this route for end-to-end demo without GitHub.
 */
import { NextResponse } from 'next/server'
import { dispatch, isKnownProvider } from '@/features/integrations/ci-providers'
import { verifyHmac as verifyGithubHmac } from '@/features/integrations/ci-providers/github'
import { recordCiEvent } from '@/lib/mock-store'
import { eventBus } from '@/lib/event-bus'

interface RouteContext {
  params: Promise<{ provider: string }>
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { provider } = await context.params

  if (!isKnownProvider(provider)) {
    return new NextResponse('Unknown provider', { status: 404 })
  }

  const rawBody = await request.text()

  // Environment-gated HMAC verification (per demo recommendation #1000).
  if (process.env.NODE_ENV === 'production') {
    if (provider === 'github') {
      const sig = request.headers.get('x-hub-signature-256')
      const secret = process.env.GITHUB_WEBHOOK_SECRET ?? ''
      if (!secret || !verifyGithubHmac(rawBody, sig, secret)) {
        return new NextResponse('Invalid signature', { status: 401 })
      }
    }
    // Bitbucket/GitLab verification deferred with the stubs.
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new NextResponse('Invalid JSON', { status: 400 })
  }

  // The runId is passed via header `X-Qably-Run-Id` (set by the CI
  // workflow when launched from Qably). Falls back to extraction inside
  // the adapter if not present.
  const runIdHeader = request.headers.get('x-qably-run-id')

  const event = dispatch(provider, payload, runIdHeader)

  if (!event) {
    // Either a stub provider (bitbucket/gitlab) or a non-CI event
    // (push, PR, etc.). 501 for stubs lets the client know to retry
    // after we implement them; 202 for non-CI events acknowledges
    // receipt without action.
    if (provider === 'github') {
      return new NextResponse(null, { status: 202 })
    }
    return new NextResponse('Provider not implemented', { status: 501 })
  }

  recordCiEvent(event)
  // Cross-module handoff: emit on the bus so the runs/ subscriber
  // (registered in app-shell.tsx) can transition the run.
  eventBus.emit('ci.event.received', { event })
  return NextResponse.json({ ok: true, eventId: event.eventId, runId: event.runId })
}

export async function GET(): Promise<Response> {
  return new NextResponse('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } })
}
