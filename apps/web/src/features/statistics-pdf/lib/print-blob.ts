/** How long the browser gets to load the PDF into the frame before printing is abandoned. */
const LOAD_TIMEOUT_MS = 15_000

interface PrintJob {
  readonly frame: HTMLIFrameElement
  readonly url: string
  timer: number | undefined
}

let activeJob: PrintJob | null = null

function release(job: PrintJob): void {
  window.clearTimeout(job.timer)
  job.frame.remove()
  URL.revokeObjectURL(job.url)
  if (activeJob === job) activeJob = null
}

/**
 * Loads a generated PDF into a hidden frame and opens the browser's print
 * dialog for it, so the person prints (or saves from the dialog) instead of
 * triggering a download.
 *
 * The frame and its object URL stay alive after the dialog opens: some
 * browsers print asynchronously, and removing the document would cancel the
 * job. They are released when the next print starts, so at most one is held.
 *
 * Resolves once the print dialog has been requested; rejects if the PDF does
 * not load in time or the browser refuses to print.
 */
export function printBlob(blob: Blob): Promise<void> {
  if (activeJob) release(activeJob)

  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.tabIndex = -1
  // Off-screen but still laid out: a display:none frame never renders the PDF viewer, and
  // a zero-sized one prints blank in some browsers.
  frame.style.cssText =
    'position:fixed;left:0;top:0;width:1px;height:100px;border:0;margin:0;padding:0;opacity:0;pointer-events:none'
  const job: PrintJob = { frame, url: URL.createObjectURL(blob), timer: undefined }
  activeJob = job

  return new Promise<void>((resolve, reject) => {
    const fail = (error: unknown) => {
      release(job)
      reject(error)
    }
    job.timer = window.setTimeout(() => fail(new Error('The PDF did not load in time.')), LOAD_TIMEOUT_MS)

    frame.addEventListener('load', () => {
      try {
        const target = frame.contentWindow
        if (!target) throw new Error('The PDF frame has no window to print.')
        // Some browsers fire a load for the initial blank document before the PDF arrives.
        if (target.location.href === 'about:blank') return

        window.clearTimeout(job.timer)
        target.focus()
        target.print()
        resolve()
      } catch (error) {
        fail(error)
      }
    })

    frame.src = job.url
    document.body.append(frame)
  })
}
