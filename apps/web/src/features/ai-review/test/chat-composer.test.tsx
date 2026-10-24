import { screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { ASSISTANT_MODEL_NAME } from '@qably/types'
import {
  assistantRecord,
  chatThread,
  controlStream,
  projectSuites,
  renderChatPanel,
  userRecord,
} from './chat-test-harness'

let searchParamsQuery = ''

vi.mock('@/features/projects/suites/api/suites.api', () => ({
  listSuites: () => Promise.resolve(projectSuites),
  getSuite: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useParams: () => ({}),
  usePathname: () => '/aeris',
  useRouter: () => ({
    back: () => {},
    forward: () => {},
    prefetch: () => Promise.resolve(),
    push: () => {},
    refresh: () => {},
    replace: () => {},
  }),
  useSearchParams: () => new URLSearchParams(searchParamsQuery),
}))

const listThreads = vi.fn()
const createThread = vi.fn()
const getThread = vi.fn()
const streamMessage = vi.fn()

vi.mock('@/features/ai-review/api/chat.api', () => ({
  listThreads: (...args: unknown[]) => listThreads(...args),
  createThread: (...args: unknown[]) => createThread(...args),
  getThread: (...args: unknown[]) => getThread(...args),
  streamMessage: (...args: unknown[]) => streamMessage(...args),
  sendToReview: vi.fn(),
  deleteThread: vi.fn(),
}))

const question = userRecord('message-1', 'Question')
const reply = assistantRecord('message-2', 'Answer')

async function renderComposer({ withDeepLinkedCase = false } = {}) {
  searchParamsQuery = withDeepLinkedCase ? 'case=tc-1' : ''
  await act(async () => {
    renderChatPanel()
  })
  return userEvent.setup()
}

function messageBox() {
  return screen.getByRole('textbox', { name: 'Message' })
}

function sentBody() {
  return streamMessage.mock.calls[streamMessage.mock.calls.length - 1]?.[2]
}

describe('AerisComposer', () => {
  beforeEach(() => {
    listThreads.mockResolvedValue([])
    createThread.mockResolvedValue(chatThread)
    streamMessage.mockResolvedValue({ userMessage: question, assistantMessage: reply })
    getThread.mockResolvedValue({ ...chatThread, messages: [question, reply] })
  })

  afterEach(() => {
    vi.clearAllMocks()
    searchParamsQuery = ''
  })

  it('names the model under the input, not above it', async () => {
    await renderComposer()

    const model = screen.getByText('Aeris')
    expect(messageBox().compareDocumentPosition(model) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('labels the model chip for a screen reader', async () => {
    await renderComposer()

    const chip = screen.getByText('Aeris').parentElement
    expect(chip).toHaveTextContent(/model|modelo/i)
    expect(chip).toHaveAttribute('title', ASSISTANT_MODEL_NAME)
  })

  it('sends the typed message from the send button and clears the input', async () => {
    const user = await renderComposer()

    await user.type(messageBox(), 'What suites exist?')
    await user.click(screen.getByRole('button', { name: 'Send message' }))

    await waitFor(() => expect(sentBody()).toEqual({ content: 'What suites exist?', caseIds: [] }))
    expect(messageBox()).toHaveValue('')
  })

  it('sends on Enter without Shift', async () => {
    const user = await renderComposer()

    await user.type(messageBox(), 'What suites exist?{enter}')

    await waitFor(() => expect(sentBody()).toEqual({ content: 'What suites exist?', caseIds: [] }))
  })

  it('inserts a newline on Shift+Enter instead of sending', async () => {
    const user = await renderComposer()

    await user.type(messageBox(), 'Line one{Shift>}{enter}{/Shift}Line two')

    expect(messageBox()).toHaveValue('Line one\nLine two')
    expect(streamMessage).not.toHaveBeenCalled()
  })

  it('caps the message at 4000 characters', async () => {
    await renderComposer()

    expect(messageBox()).toHaveAttribute('maxLength', '4000')
  })

  it('does not send an empty message', async () => {
    const user = await renderComposer()

    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled()
    await user.type(messageBox(), '   {enter}')

    expect(createThread).not.toHaveBeenCalled()
    expect(streamMessage).not.toHaveBeenCalled()
  })

  it('keeps the input usable while a reply streams but does not send a second message', async () => {
    controlStream(streamMessage)
    const user = await renderComposer()

    await user.type(messageBox(), 'First question{enter}')
    await waitFor(() => expect(streamMessage).toHaveBeenCalledTimes(1))

    expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /stop the reply/i })).toBeInTheDocument()

    await user.type(messageBox(), 'Second question{enter}')

    expect(messageBox()).toHaveValue('Second question')
    expect(streamMessage).toHaveBeenCalledTimes(1)
  })

  describe('attached cases', () => {
    it('removes an attached case from the chip row', async () => {
      const user = await renderComposer({ withDeepLinkedCase: true })

      await user.click(screen.getByRole('button', { name: 'Remove Valid login redirects to dashboard' }))

      expect(screen.queryByText('Valid login redirects to dashboard')).not.toBeInTheDocument()
    })

    it('attaches a case chosen from the picker', async () => {
      const user = await renderComposer()

      await user.click(screen.getByRole('button', { name: 'Attach a case' }))
      await user.click(await screen.findByText('Checkout with empty cart blocked'))

      expect(screen.getByText('Checkout with empty cart blocked')).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('sends the attached cases and clears them after sending', async () => {
      const user = await renderComposer({ withDeepLinkedCase: true })

      await user.type(messageBox(), 'Improve this case{enter}')

      await waitFor(() => expect(sentBody()).toEqual({ content: 'Improve this case', caseIds: ['tc-1'] }))
      expect(
        screen.queryByRole('button', { name: 'Remove Valid login redirects to dashboard' }),
      ).not.toBeInTheDocument()
    })

    it('disables the attach control once 5 cases are attached', async () => {
      const user = await renderComposer({ withDeepLinkedCase: true })

      const attachButton = screen.getByRole('button', { name: 'Attach a case' })
      expect(attachButton).not.toBeDisabled()

      for (const name of [
        'Invalid credentials shows error',
        'Reset password flow',
        'Checkout with empty cart blocked',
        'Discount code applied correctly',
      ]) {
        await user.click(attachButton)
        await user.click(await screen.findByText(name))
      }

      expect(screen.getByText('Discount code applied correctly')).toBeInTheDocument()
      expect(attachButton).toBeDisabled()
      expect(screen.getByText('You can attach up to 5 cases.')).toBeInTheDocument()
    })
  })

  describe('file attachment', () => {
    it('opens an inline path input when the file button is clicked', async () => {
      const user = await renderComposer()

      await user.click(screen.getByRole('button', { name: 'Reference a file' }))

      expect(screen.getByRole('textbox', { name: 'File path' })).toBeInTheDocument()
    })

    it('cancels the inline input on Escape', async () => {
      const user = await renderComposer()

      await user.click(screen.getByRole('button', { name: 'Reference a file' }))
      await user.type(screen.getByRole('textbox', { name: 'File path' }), 'src/foo.ts{Escape}')

      expect(screen.queryByRole('textbox', { name: 'File path' })).not.toBeInTheDocument()
    })

    it('confirms a valid path into a removable chip and disables the button', async () => {
      const user = await renderComposer()

      await user.click(screen.getByRole('button', { name: 'Reference a file' }))
      await user.type(screen.getByRole('textbox', { name: 'File path' }), 'src/components/Button.tsx{enter}')

      expect(screen.getByText('src/components/Button.tsx')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reference a file' })).toBeDisabled()
      expect(streamMessage).not.toHaveBeenCalled()
    })

    it('shows an inline error for an unsafe path and does not create a chip', async () => {
      const user = await renderComposer()

      await user.click(screen.getByRole('button', { name: 'Reference a file' }))
      await user.type(screen.getByRole('textbox', { name: 'File path' }), '../secrets.env{enter}')

      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'File path' })).toHaveAttribute('aria-invalid', 'true')
      expect(screen.queryByText('../secrets.env')).not.toBeInTheDocument()
    })

    it('removes the file chip and re-enables the button', async () => {
      const user = await renderComposer()

      await user.click(screen.getByRole('button', { name: 'Reference a file' }))
      await user.type(screen.getByRole('textbox', { name: 'File path' }), 'src/foo.ts{enter}')
      await user.click(screen.getByRole('button', { name: 'Remove src/foo.ts' }))

      expect(screen.queryByText('src/foo.ts')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Reference a file' })).not.toBeDisabled()
    })

    it('sends the attached file path and clears it after sending', async () => {
      const user = await renderComposer()

      await user.click(screen.getByRole('button', { name: 'Reference a file' }))
      await user.type(screen.getByRole('textbox', { name: 'File path' }), 'src/foo.ts{enter}')
      await user.type(messageBox(), 'Look at this file{enter}')

      await waitFor(() =>
        expect(sentBody()).toEqual({ content: 'Look at this file', caseIds: [], filePath: 'src/foo.ts' }),
      )
      expect(screen.queryByRole('button', { name: 'Remove src/foo.ts' })).not.toBeInTheDocument()
    })

    it('sends both attached cases and a file path together', async () => {
      const user = await renderComposer({ withDeepLinkedCase: true })

      await user.click(screen.getByRole('button', { name: 'Reference a file' }))
      await user.type(screen.getByRole('textbox', { name: 'File path' }), 'src/foo.ts{enter}')
      await user.type(messageBox(), 'Improve this{enter}')

      await waitFor(() =>
        expect(sentBody()).toEqual({ content: 'Improve this', caseIds: ['tc-1'], filePath: 'src/foo.ts' }),
      )
    })
  })
})
