/**
 * CI provider dispatcher.
 *
 * Routes a webhook payload to the correct provider adapter. The provider
 * name comes from the route's dynamic `[provider]` segment. Unknown
 * providers throw — the route handler maps that to a 404.
 */
import * as github from './github'
import * as bitbucket from './bitbucket'
import * as gitlab from './gitlab'
import type { NormalizedCIEvent, NormalizedCIProvider } from './types'

export type { NormalizedCIEvent, NormalizedCIProvider, NormalizedCIStatus } from './types'

export function isKnownProvider(name: string): name is NormalizedCIProvider {
  return name === 'github' || name === 'bitbucket' || name === 'gitlab'
}

/**
 * Dispatch to the right adapter. Returns `null` for non-CI events
 * (push, PR opened, etc.) — the route handler should respond 202 in
 * that case to acknowledge receipt without acting.
 */
export function dispatch(
  provider: NormalizedCIProvider,
  payload: unknown,
  runIdHeader: string | null = null,
): NormalizedCIEvent | null {
  switch (provider) {
    case 'github':
      return github.normalize(payload, runIdHeader)
    case 'bitbucket':
      return bitbucket.normalize(payload)
    case 'gitlab':
      return gitlab.normalize(payload)
  }
}

export { github, bitbucket, gitlab }
