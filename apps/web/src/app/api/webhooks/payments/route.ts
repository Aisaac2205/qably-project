/**
 * Payments webhook route — `POST /api/webhooks/payments`
 *
 * Stub. Returns 501 Not Implemented for any POST. Implemented in Commit 4
 * (billing) when the Payment provider integration lands. The route exists
 * now so the webhook consumer pattern is in place and 4xx responses are
 * testable from the billing "Simulate payment event" button in dev.
 */
export async function POST(): Promise<Response> {
  return new Response('Not Implemented — implemented in Commit 4 (billing)', {
    status: 501,
  })
}

export async function GET(): Promise<Response> {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: { Allow: 'POST' },
  })
}
