const HANDOFF_WINDOW_MS = 5000

interface FocusRequest {
  projectId: string
  at: number
}

let request: FocusRequest | null = null

export function requestNewRunFocus(projectId: string): void {
  request = { projectId, at: Date.now() }
}

export function cancelNewRunFocus(): void {
  request = null
}

export function consumeNewRunFocus(projectId: string): boolean {
  if (request === null) return false

  if (Date.now() - request.at > HANDOFF_WINDOW_MS) {
    request = null
    return false
  }

  if (request.projectId !== projectId) return false

  request = null
  return true
}
