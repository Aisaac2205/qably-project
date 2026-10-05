const RESTORE_WINDOW_MS = 1500
const COMMIT_WAIT_MS = 3000
const SETTLED_FRAMES = 6
const SETTLED_TOLERANCE_PX = 1
const MAX_ENTRIES = 200
const INTERACTION_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

export interface ScrollRestoration {
  commit: (pathname: string) => void
  destroy: () => void
}

interface RestoreSession {
  stop: () => void
}

interface PendingRestore {
  target: number
  timer: number
}

function locationKey(): string {
  return `${window.location.pathname}${window.location.search}`
}

function jumpTo(container: HTMLElement, top: number) {
  if (typeof container.scrollTo === 'function') {
    container.scrollTo({ top, behavior: 'instant' })
    return
  }

  container.scrollTop = top
}

function startRestoreSession(
  container: HTMLElement,
  target: number,
  onEnd: () => void,
): RestoreSession {
  const startedAt = performance.now()
  let frame = 0
  let settledFrames = 0
  let ended = false

  function finish() {
    if (ended) return

    ended = true
    window.cancelAnimationFrame(frame)
    for (const type of INTERACTION_EVENTS) {
      window.removeEventListener(type, finish, { capture: true })
    }
    onEnd()
  }

  function step() {
    const reachable = container.scrollHeight - container.clientHeight >= target

    if (!reachable) {
      settledFrames = 0
    } else if (Math.abs(container.scrollTop - target) > SETTLED_TOLERANCE_PX) {
      jumpTo(container, target)
      settledFrames = 0
    } else {
      settledFrames += 1
    }

    if (settledFrames >= SETTLED_FRAMES || performance.now() - startedAt >= RESTORE_WINDOW_MS) {
      finish()
      return
    }

    frame = window.requestAnimationFrame(step)
  }

  for (const type of INTERACTION_EVENTS) {
    window.addEventListener(type, finish, { capture: true, passive: true })
  }
  step()

  return { stop: finish }
}

export function createScrollRestoration(
  container: HTMLElement,
  initialPathname: string,
): ScrollRestoration {
  const positions = new Map<string, number>()
  let renderedPathname = initialPathname
  let pending: PendingRestore | null = null
  let session: RestoreSession | null = null

  function remember() {
    if (pending !== null || session !== null) return

    const key = locationKey()

    positions.delete(key)
    positions.set(key, container.scrollTop)

    if (positions.size > MAX_ENTRIES) {
      const oldest = positions.keys().next()
      if (!oldest.done) positions.delete(oldest.value)
    }
  }

  function stopSession() {
    session?.stop()
    session = null
  }

  function clearPending() {
    if (pending === null) return

    window.clearTimeout(pending.timer)
    pending = null
  }

  function begin(target: number) {
    stopSession()
    session = startRestoreSession(container, target, () => {
      session = null
    })
  }

  function onPopState() {
    clearPending()
    stopSession()

    if (window.location.hash !== '') return

    const target = positions.get(locationKey()) ?? 0

    if (window.location.pathname === renderedPathname) {
      begin(target)
      return
    }

    pending = {
      target,
      timer: window.setTimeout(() => {
        pending = null
      }, COMMIT_WAIT_MS),
    }
  }

  function commit(pathname: string) {
    renderedPathname = pathname

    if (pending === null) {
      stopSession()
      return
    }

    if (window.location.pathname !== pathname) return

    const { target } = pending

    clearPending()
    begin(target)
  }

  function destroy() {
    container.removeEventListener('scroll', remember)
    window.removeEventListener('popstate', onPopState)
    clearPending()
    stopSession()
  }

  container.addEventListener('scroll', remember, { passive: true })
  window.addEventListener('popstate', onPopState)

  return { commit, destroy }
}
