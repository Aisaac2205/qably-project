import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { printBlob } from '@/features/statistics-pdf/lib/print-blob'

const createObjectURL = vi.fn()
const revokeObjectURL = vi.fn()
// Never reset: the module keeps its last job alive between tests, so each URL must be unique.
let urlCounter = 0

interface FakeWindow {
  focus: ReturnType<typeof vi.fn>
  print: ReturnType<typeof vi.fn>
  location: { href: string }
}

function pdfFrames() {
  return document.querySelectorAll('iframe')
}

/** jsdom never loads a blob document, so the frame is given a stand-in window and then "loads". */
function loadFrame(frame: HTMLIFrameElement, href = frame.getAttribute('src') ?? ''): FakeWindow {
  const fake: FakeWindow = { focus: vi.fn(), print: vi.fn(), location: { href } }
  Object.defineProperty(frame, 'contentWindow', { value: fake, configurable: true })
  frame.dispatchEvent(new Event('load'))
  return fake
}

describe('printBlob', () => {
  beforeEach(() => {
    createObjectURL.mockImplementation(() => `blob:qably-report-${(urlCounter += 1)}`)
    Object.assign(URL, { createObjectURL, revokeObjectURL })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    document.body.replaceChildren()
  })

  it('loads the PDF into a hidden frame and opens the print dialog once it has loaded', async () => {
    const printing = printBlob(new Blob(['%PDF-1.3'], { type: 'application/pdf' }))

    const [frame] = pdfFrames()
    expect(frame).toBeDefined()
    const url = frame?.getAttribute('src')
    expect(url).toMatch(/^blob:qably-report-\d+$/)
    expect(frame).toHaveAttribute('aria-hidden', 'true')

    const fake = loadFrame(frame as HTMLIFrameElement)
    await expect(printing).resolves.toBeUndefined()
    expect(fake.focus).toHaveBeenCalledTimes(1)
    expect(fake.print).toHaveBeenCalledTimes(1)
  })

  it('ignores the blank document a browser may load before the PDF', async () => {
    const printing = printBlob(new Blob(['%PDF'], { type: 'application/pdf' }))
    const [frame] = pdfFrames()

    const blank = loadFrame(frame as HTMLIFrameElement, 'about:blank')
    expect(blank.print).not.toHaveBeenCalled()

    const fake = loadFrame(frame as HTMLIFrameElement)
    await printing
    expect(fake.print).toHaveBeenCalledTimes(1)
  })

  it('keeps the document alive after printing and releases it when the next print starts', async () => {
    const first = printBlob(new Blob(['%PDF'], { type: 'application/pdf' }))
    const firstUrl = pdfFrames()[0]?.getAttribute('src') as string
    loadFrame(pdfFrames()[0] as HTMLIFrameElement)
    await first
    expect(pdfFrames()).toHaveLength(1)
    expect(revokeObjectURL).not.toHaveBeenCalledWith(firstUrl)

    void printBlob(new Blob(['%PDF'], { type: 'application/pdf' }))
    expect(revokeObjectURL).toHaveBeenCalledWith(firstUrl)
    expect(pdfFrames()).toHaveLength(1)
    expect(pdfFrames()[0]?.getAttribute('src')).not.toBe(firstUrl)
  })

  it('rejects and cleans up when the print dialog cannot be opened', async () => {
    const printing = printBlob(new Blob(['%PDF'], { type: 'application/pdf' }))
    const [frame] = pdfFrames()
    const url = frame?.getAttribute('src') ?? ''
    const fake: FakeWindow = {
      focus: vi.fn(),
      print: vi.fn(() => {
        throw new Error('print blocked')
      }),
      location: { href: url },
    }
    Object.defineProperty(frame, 'contentWindow', { value: fake, configurable: true })
    frame?.dispatchEvent(new Event('load'))

    await expect(printing).rejects.toThrow('print blocked')
    expect(pdfFrames()).toHaveLength(0)
    expect(revokeObjectURL).toHaveBeenCalledWith(url)
  })

  it('rejects and cleans up when the PDF never loads', async () => {
    vi.useFakeTimers()
    const printing = printBlob(new Blob(['%PDF'], { type: 'application/pdf' }))
    const url = pdfFrames()[0]?.getAttribute('src') ?? ''
    const assertion = expect(printing).rejects.toThrow(/did not load/i)

    await vi.advanceTimersByTimeAsync(15_000)

    await assertion
    expect(pdfFrames()).toHaveLength(0)
    expect(revokeObjectURL).toHaveBeenCalledWith(url)
  })
})
