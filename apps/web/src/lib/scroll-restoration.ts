const RESTORE_WINDOW_MS = 1500
const COMMIT_WAIT_MS = 3000
const SETTLED_FRAMES = 6
const SETTLED_TOLERANCE_PX = 1
const MAX_ENTRIES = 200
const INTERACTION_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const
const MODIFIER_KEYS = new Set(['Alt', 'Control', 'Shift', 'Meta', 'OS', 'AltGraph'])

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
  stopWatching: () => void
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

function maxScrollTop(container: HTMLElement): number {
  return Math.max(0, container.scrollHeight - container.clientHeight)
}

function isDeliberateInteraction(event: Event): boolean {
  if (!(event instanceof KeyboardEvent)) return true

  return !event.repeat && !MODIFIER_KEYS.has(event.key)
}

function watchInteraction(onInteract: () => void): () => void {
  function handle(event: Event) {
    if (isDeliberateInteraction(event)) onInteract()
  }

  for (const type of INTERACTION_EVENTS) {
    window.addEventListener(type, handle, { capture: true, passive: true })
  }

  return () => {
    for (const type of INTERACTION_EVENTS) {
      window.removeEventListener(type, handle, { capture: true })
    }
  }
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
    stopWatching()
    onEnd()
  }

  function step() {
    const reachable = maxScrollTop(container) >= target

    if (!reachable) {
      settledFrames = 0
    } else if (Math.abs(container.scrollTop - target) > SETTLED_TOLERANCE_PX) {
      jumpTo(container, target)
      settledFrames = 0
    } else {
      settledFrames += 1
    }

    if (settledFrames >= SETTLED_FRAMES) {
      finish()
      return
    }

    if (performance.now() - startedAt >= RESTORE_WINDOW_MS) {
      const furthest = maxScrollTop(container)

      if (!reachable && Math.abs(container.scrollTop - furthest) > SETTLED_TOLERANCE_PX) {
        jumpTo(container, furthest)
      }
      finish()
      return
    }

    frame = window.requestAnimationFrame(step)
  }

  const stopWatching = watchInteraction(finish)
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
    pending.stopWatching()
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
      timer: window.setTimeout(clearPending, COMMIT_WAIT_MS),
      stopWatching: watchInteraction(clearPending),
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
