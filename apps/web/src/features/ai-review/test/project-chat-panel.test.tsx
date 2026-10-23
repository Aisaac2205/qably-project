import { screen, act, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { ApiError } from '@/lib/api-client'
import { ChatStreamError } from '@/features/ai-review/lib/chat-stream'
import {
  ASSISTANT_MODEL_NAME,
  type ChatThreadDetailRecord,
  type Suite,
} from '@qably/types'
import {
  assistantRecord,
  chatThread,
  controlStream,
  createTestClient,
  projectSuites,
  renderChatPanel,
  userRecord,
} from './chat-test-harness'

let searchParamsQuery = ''

const listSuitesMock = vi.fn()

vi.mock('@/features/projects/suites/api/suites.api', () => ({
  listSuites: (...args: unknown[]) => listSuitesMock(...args),
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
const sendToReview = vi.fn()
const deleteThread = vi.fn()

vi.mock('@/features/ai-review/api/chat.api', () => ({
  listThreads: (...args: unknown[]) => listThreads(...args),
  createThread: (...args: unknown[]) => createThread(...args),
  getThread: (...args: unknown[]) => getThread(...args),
  streamMessage: (...args: unknown[]) => streamMessage(...args),
  sendToReview: (...args: unknown[]) => sendToReview(...args),
  deleteThread: (...args: unknown[]) => deleteThread(...args),
}))

const question = userRecord('message-1', 'How many cases are pending?')
const reply = assistantRecord('message-2', 'There are 4 cases pending review.')
const threadDetailAfterReply: ChatThreadDetailRecord = {
  ...chatThread,
  messages: [question, reply],
}

function detailWith(...messages: ChatThreadDetailRecord['messages']): ChatThreadDetailRecord {
  return { ...chatThread, messages }
}

async function renderPanel(options?: Parameters<typeof renderChatPanel>[0]) {
  let rendered!: ReturnType<typeof renderChatPanel>
  await act(async () => {
    rendered = renderChatPanel(options)
  })
  return rendered
}

async function openThread(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByTitle('How many cases are pending?'))
}

describe('ProjectChatPanel', () => {
  afterEach(() => {
    vi.clearAllMocks()
    searchParamsQuery = ''
  })

  beforeEach(() => {
    listSuitesMock.mockResolvedValue(projectSuites)
  })

  it('reads the suites of the project with listSuites, the whole list the composer needs', async () => {
    listThreads.mockResolvedValue([])

    await renderPanel()

    await waitFor(() => expect(listSuitesMock).toHaveBeenCalledTimes(1))
    expect(listSuitesMock.mock.calls[0][0]).toBe('proj-1')
  })

  it('starts a new thread and shows the assistant reply after sending a message', async () => {
    listThreads.mockResolvedValue([])
    createThread.mockResolvedValue(chatThread)
    streamMessage.mockResolvedValue({ userMessage: question, assistantMessage: reply })
    getThread.mockResolvedValue(threadDetailAfterReply)
    const user = userEvent.setup()

    await renderPanel()
    expect(screen.getByText(/how can I help you today/i)).toBeInTheDocument()

    const textarea = screen.getByRole('textbox', { name: 'Message' })
    await user.type(textarea, 'How many cases are pending?{enter}')

    await waitFor(() => expect(screen.getByText('There are 4 cases pending review.')).toBeInTheDocument())
  })

  it('keeps the user message visible and shows the assistant as unavailable', async () => {
    listThreads.mockResolvedValue([])
    createThread.mockResolvedValue(chatThread)
    streamMessage.mockRejectedValue(new ApiError(503, 'unavailable', 'provider-unavailable'))
    getThread.mockResolvedValue(detailWith(userRecord('message-3', 'Another question')))
    const user = userEvent.setup()

    await renderPanel()

    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Another question{enter}')

    expect(await screen.findByText('Another question')).toBeInTheDocument()
    expect(await screen.findByText(/not available right now/i)).toBeInTheDocument()
  })

  it('names the model answering, labelled as the model', async () => {
    listThreads.mockResolvedValue([])

    await renderPanel()

    const chip = screen.getByText(ASSISTANT_MODEL_NAME)
    expect(chip).toBeInTheDocument()
    expect(chip.parentElement).toHaveTextContent(/model|modelo/i)
  })

  it('titles the panel with the conversation being read', async () => {
    listThreads.mockResolvedValue([chatThread])
    getThread.mockResolvedValue(threadDetailAfterReply)
    const user = userEvent.setup()

    await renderPanel()
    await openThread(user)

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'How many cases are pending?' }),
      ).toBeInTheDocument(),
    )
  })

  it('reaches the conversations from a drawer on a narrow viewport', async () => {
    listThreads.mockResolvedValue([chatThread])
    const user = userEvent.setup()

    await renderPanel()

    await user.click(screen.getByRole('button', { name: /open conversations|ver conversaciones/i }))

    const drawer = await screen.findByRole('dialog')
    expect(within(drawer).getByText('How many cases are pending?')).toBeInTheDocument()
  })

  it('leaves the header untitled until a conversation is actually open', async () => {
    listThreads.mockResolvedValue([chatThread])

    await renderPanel()

    expect(
      screen.queryByRole('heading', { name: /new chat|nuevo chat/i }),
    ).not.toBeInTheDocument()
  })

  it('starts a new conversation from the header on desktop', async () => {
    listThreads.mockResolvedValue([chatThread])
    getThread.mockResolvedValue(threadDetailAfterReply)
    const user = userEvent.setup()

    await renderPanel()
    await openThread(user)
    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'How many cases are pending?' }),
      ).toBeInTheDocument(),
    )

    const iconOnlyNewChat = screen
      .getAllByRole('button', { name: /^(new chat|nuevo chat)$/i })
      .find((button) => button.textContent === '')
    expect(iconOnlyNewChat).toBeDefined()

    await user.click(iconOnlyNewChat as HTMLElement)

    expect(
      screen.queryByRole('heading', { name: 'How many cases are pending?' }),
    ).not.toBeInTheDocument()
  })

  it('offers no back control unless an exit is wired', async () => {
    listThreads.mockResolvedValue([])

    await renderPanel()

    expect(
      screen.queryByRole('button', { name: /back to the review queue|volver a la cola/i }),
    ).not.toBeInTheDocument()
  })

  it('reports the exit when the back control is used', async () => {
    listThreads.mockResolvedValue([])
    const onExit = vi.fn()
    const user = userEvent.setup()

    await renderPanel({ onExit, seedSuites: false })

    const back = screen.getByRole('button', {
      name: /back to the review queue|volver a la cola/i,
    })
    expect(back).toHaveTextContent(/review queue|cola de revisión/i)

    await user.click(back)
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('closes the drawer once a conversation is picked', async () => {
    listThreads.mockResolvedValue([chatThread])
    getThread.mockResolvedValue(threadDetailAfterReply)
    const user = userEvent.setup()

    await renderPanel()

    await user.click(screen.getByRole('button', { name: /open conversations|ver conversaciones/i }))
    const drawer = await screen.findByRole('dialog')
    await user.click(within(drawer).getByText('How many cases are pending?'))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  describe('?case= deep link', () => {
    it('seeds the composer with the case from a ?case= deep link', async () => {
      listThreads.mockResolvedValue([])
      searchParamsQuery = 'case=tc-1'

      await renderPanel()

      expect(screen.getByText('Valid login redirects to dashboard')).toBeInTheDocument()
      expect(screen.getByText('Authentication')).toBeInTheDocument()
    })

    it('seeds the composer with the deep-linked case once suites resolve from a cold cache', async () => {
      listThreads.mockResolvedValue([])
      searchParamsQuery = 'case=tc-1'
      let resolveSuites: (suites: Suite[]) => void = () => {}
      const suitesPromise = new Promise<Suite[]>((resolve) => {
        resolveSuites = resolve
      })
      listSuitesMock.mockReturnValue(suitesPromise)

      await renderPanel({ client: createTestClient(), seedSuites: false })

      expect(screen.queryByText('Valid login redirects to dashboard')).not.toBeInTheDocument()

      await act(async () => {
        resolveSuites(projectSuites)
        await suitesPromise
      })

      expect(await screen.findByText('Valid login redirects to dashboard')).toBeInTheDocument()
      expect(screen.getByText('Authentication')).toBeInTheDocument()
    })

    it('shows no chip and does not crash when the deep-linked case id is not in the project', async () => {
      listThreads.mockResolvedValue([])
      searchParamsQuery = 'case=does-not-exist'

      await renderPanel()

      expect(screen.queryByText('Valid login redirects to dashboard')).not.toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'Message' })).toBeInTheDocument()
    })

    it('sends the deep-linked case with the first message', async () => {
      listThreads.mockResolvedValue([])
      searchParamsQuery = 'case=tc-1'
      createThread.mockResolvedValue(chatThread)
      streamMessage.mockResolvedValue({ userMessage: question, assistantMessage: reply })
      getThread.mockResolvedValue(threadDetailAfterReply)
      const user = userEvent.setup()

      await renderPanel()
      await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Improve this case{enter}')

      await waitFor(() =>
        expect(streamMessage).toHaveBeenCalledWith(
          'proj-1',
          'thread-1',
          { content: 'Improve this case', caseIds: ['tc-1'] },
          expect.anything(),
        ),
      )
    })
  })

  describe('empty thread', () => {
    it('shows the loading state instead of the greeting while the selected thread is still loading', async () => {
      listThreads.mockResolvedValue([chatThread])
      getThread.mockReturnValue(new Promise(() => {}))
      const user = userEvent.setup()

      await renderPanel()
      await openThread(user)

      expect(await screen.findByText(/loading the conversation/i)).toBeInTheDocument()
      expect(screen.queryByText(/how can I help you today/i)).not.toBeInTheDocument()
    })

    it('greets with a hint and suggested questions grounded in the project data', async () => {
      listThreads.mockResolvedValue([])

      await renderPanel()

      expect(screen.getByText(/how can I help you today/i)).toBeInTheDocument()
      expect(screen.getByText(/ask anything/i)).toBeInTheDocument()
      const suggestions = screen.getByRole('group', { name: /suggested questions/i })
      expect(within(suggestions).getAllByRole('button')).toHaveLength(3)
      expect(within(suggestions).getByRole('button', { name: /thinnest suite/i })).toBeInTheDocument()
      expect(within(suggestions).getByRole('button', { name: /recent runs/i })).toBeInTheDocument()
      expect(within(suggestions).getByRole('button', { name: /coverage gaps/i })).toBeInTheDocument()
    })

    it('sends a suggested question as the first message', async () => {
      listThreads.mockResolvedValue([])
      createThread.mockResolvedValue(chatThread)
      streamMessage.mockResolvedValue({ userMessage: question, assistantMessage: reply })
      getThread.mockResolvedValue(threadDetailAfterReply)
      const user = userEvent.setup()

      await renderPanel()
      await user.click(screen.getByRole('button', { name: /thinnest suite/i }))

      await waitFor(() =>
        expect(streamMessage).toHaveBeenCalledWith(
          'proj-1',
          'thread-1',
          { content: 'Which suite has the fewest test cases, and how many does it have?', caseIds: [] },
          expect.anything(),
        ),
      )
    })
  })

  describe('streaming reply', () => {
    it('shows the reply text as it streams, then the canonical reply once done', async () => {
      listThreads.mockResolvedValue([chatThread])
      getThread.mockResolvedValueOnce(threadDetailAfterReply).mockReturnValue(new Promise(() => {}))
      const stream = controlStream(streamMessage)
      const user = userEvent.setup()

      await renderPanel()
      await openThread(user)
      await screen.findByText('There are 4 cases pending review.')

      await user.type(screen.getByRole('textbox', { name: 'Message' }), 'And failing ones?{enter}')
      await waitFor(() => expect(streamMessage).toHaveBeenCalled())

      expect(screen.getByText('And failing ones?')).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent(/thinking/i)

      act(() => {
        stream.emit('Two cases ')
        stream.emit('are failing.')
      })

      expect(await screen.findByText('Two cases are failing.')).toBeInTheDocument()
      expect(screen.queryByText(/thinking/i)).not.toBeInTheDocument()

      await act(async () => {
        stream.finish({
          userMessage: userRecord('message-3', 'And failing ones?'),
          assistantMessage: assistantRecord('message-4', 'Two cases failed in the last run.'),
        })
      })

      expect(await screen.findByText('Two cases failed in the last run.')).toBeInTheDocument()
      expect(screen.queryByText('Two cases are failing.')).not.toBeInTheDocument()
    })

    it('announces a finished reply once instead of every streamed token', async () => {
      listThreads.mockResolvedValue([chatThread])
      getThread.mockResolvedValueOnce(threadDetailAfterReply).mockReturnValue(new Promise(() => {}))
      const stream = controlStream(streamMessage)
      const user = userEvent.setup()

      const { container } = await renderPanel()
      await openThread(user)
      await screen.findByText('There are 4 cases pending review.')
      const liveRegion = container.querySelector('[aria-live="polite"]') as HTMLElement
      const announcement = liveRegion.querySelector('span')

      await user.type(screen.getByRole('textbox', { name: 'Message' }), 'And failing ones?{enter}')
      await waitFor(() => expect(streamMessage).toHaveBeenCalled())
      act(() => {
        stream.emit('Two cases are failing.')
      })

      expect(liveRegion).not.toHaveTextContent('Two cases are failing.')
      expect(liveRegion.querySelector('span')).toBe(announcement)

      await act(async () => {
        stream.finish({
          userMessage: userRecord('message-3', 'And failing ones?'),
          assistantMessage: assistantRecord('message-4', 'Two cases failed.'),
        })
      })

      expect(liveRegion).toHaveTextContent(/new reply/i)
      expect(liveRegion).not.toHaveTextContent('Two cases failed.')
      expect(liveRegion.querySelector('span')).not.toBe(announcement)
    })

    it('swaps send for a stop control that cancels the streaming reply', async () => {
      listThreads.mockResolvedValue([chatThread])
      getThread.mockResolvedValue(threadDetailAfterReply)
      const stream = controlStream(streamMessage)
      const user = userEvent.setup()

      await renderPanel()
      await openThread(user)
      await screen.findByText('There are 4 cases pending review.')

      await user.type(screen.getByRole('textbox', { name: 'Message' }), 'And failing ones?{enter}')
      await waitFor(() => expect(streamMessage).toHaveBeenCalled())
      act(() => {
        stream.emit('Partial answer')
      })

      expect(screen.queryByRole('button', { name: 'Send message' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /stop the reply/i }))

      expect(stream.signal()?.aborted).toBe(true)
      await waitFor(() => expect(screen.queryByText('Partial answer')).not.toBeInTheDocument())
      expect(await screen.findByRole('button', { name: 'Send message' })).toBeInTheDocument()
      expect(screen.getByRole('textbox', { name: 'Message' })).toHaveFocus()
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('shows the unavailable notice when the provider fails mid-stream', async () => {
      listThreads.mockResolvedValue([chatThread])
      getThread
        .mockResolvedValueOnce(threadDetailAfterReply)
        .mockResolvedValue(detailWith(question, reply, userRecord('message-3', 'And failing ones?')))
      const stream = controlStream(streamMessage)
      const user = userEvent.setup()

      await renderPanel()
      await openThread(user)
      await screen.findByText('There are 4 cases pending review.')

      await user.type(screen.getByRole('textbox', { name: 'Message' }), 'And failing ones?{enter}')
      await waitFor(() => expect(streamMessage).toHaveBeenCalled())
      act(() => {
        stream.emit('Partial answer')
      })
      await act(async () => {
        stream.fail(new ChatStreamError('Model went away', 'provider-unavailable'))
      })

      expect(await screen.findByText(/not available right now/i)).toBeInTheDocument()
      expect(screen.queryByText('Partial answer')).not.toBeInTheDocument()
      expect(screen.getAllByText('And failing ones?')).toHaveLength(1)
    })

    it('tells a spent daily budget apart from a provider outage', async () => {
      listThreads.mockResolvedValue([])
      createThread.mockResolvedValue(chatThread)
      streamMessage.mockRejectedValue(new ApiError(503, 'Budget spent', 'quota-exhausted'))
      getThread.mockResolvedValue(detailWith(userRecord('message-3', 'Budget question')))
      const user = userEvent.setup()

      await renderPanel()
      await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Budget question{enter}')

      expect(await screen.findByText(/budget is used up/i)).toBeInTheDocument()
    })

    it('keeps the question and names the problem when the message cannot be sent', async () => {
      listThreads.mockResolvedValue([])
      createThread.mockResolvedValue(chatThread)
      streamMessage.mockRejectedValue(new ApiError(429, 'Slow down'))
      getThread.mockResolvedValue(detailWith())
      const user = userEvent.setup()

      await renderPanel()
      await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Too fast{enter}')

      expect(await screen.findByRole('alert')).toHaveTextContent(/too many messages/i)
      expect(screen.getByText('Too fast')).toBeInTheDocument()
    })
  })

  describe('messages', () => {
    it('renders a reply as markdown with a highlighted code block', async () => {
      listThreads.mockResolvedValue([chatThread])
      getThread.mockResolvedValue(
        detailWith(
          question,
          assistantRecord('message-2', 'Pending cases:\n\n- **Login**\n- Checkout\n\n```ts\nconst total = 4\n```'),
        ),
      )
      const user = userEvent.setup()

      await renderPanel()
      await openThread(user)

      const listItem = await screen.findByText('Login')
      expect(listItem.tagName).toBe('STRONG')
      expect(listItem.closest('li')).not.toBeNull()
      const codeBlock = screen.getByText('ts').parentElement as HTMLElement
      const code = codeBlock.querySelector('pre > code') as HTMLElement
      expect(code).toHaveTextContent('const total = 4')
      expect(code.querySelector('[style*="--sh-keyword"]')).toHaveTextContent('const')
    })

    it('names the model on every assistant reply and leaves the question unattributed', async () => {
      listThreads.mockResolvedValue([chatThread])
      getThread.mockResolvedValue(threadDetailAfterReply)
      const user = userEvent.setup()

      await renderPanel()
      await openThread(user)

      const replyText = await screen.findByText('There are 4 cases pending review.')
      const replyBubble = replyText.closest('.rounded-2xl') as HTMLElement
      expect(within(replyBubble).getByText(ASSISTANT_MODEL_NAME)).toBeInTheDocument()
      const questionBubble = screen.getByText('How many cases are pending?', { selector: 'p' }).closest('.rounded-2xl') as HTMLElement
      expect(questionBubble).not.toHaveTextContent(ASSISTANT_MODEL_NAME)
    })

    it('copies an assistant reply to the clipboard', async () => {
      listThreads.mockResolvedValue([chatThread])
      getThread.mockResolvedValue(threadDetailAfterReply)
      const user = userEvent.setup()

      await renderPanel()
      await openThread(user)
      await screen.findByText('There are 4 cases pending review.')

      await user.click(screen.getByRole('button', { name: /copy reply/i }))

      await expect(navigator.clipboard.readText()).resolves.toBe('There are 4 cases pending review.')
      expect(await screen.findByRole('button', { name: /copied/i })).toBeInTheDocument()
    })

    it('shows the chips of the cases attached to a question', async () => {
      listThreads.mockResolvedValue([chatThread])
      getThread.mockResolvedValue(
        detailWith(
          userRecord('message-1', 'Improve this case', {
            attachedCases: [{ id: 'tc-1', name: 'Valid login redirects to dashboard', suiteName: 'Authentication' }],
          }),
          reply,
        ),
      )
      const user = userEvent.setup()

      await renderPanel()
      await openThread(user)

      expect(await screen.findByText('Valid login redirects to dashboard')).toBeInTheDocument()
      expect(screen.getByText('Authentication')).toBeInTheDocument()
    })

    it('marks a reply that declined for lack of grounding, and only that one', async () => {
      listThreads.mockResolvedValue([chatThread])
      getThread.mockResolvedValue(
        detailWith(
          question,
          assistantRecord('message-2', 'Grounded answer', {
            grounding: { status: 'grounded', references: [] },
          }),
          userRecord('message-3', 'Another'),
          assistantRecord('message-4', 'I cannot verify that', { grounding: { status: 'insufficient' } }),
        ),
      )
      const user = userEvent.setup()

      await renderPanel()
      await openThread(user)
      await screen.findByText('I cannot verify that')

      expect(screen.getAllByText(/answered without citing specific data/i)).toHaveLength(1)
    })

    it('renders the suggested cases of a reply and sends one to review', async () => {
      listThreads.mockResolvedValue([chatThread])
      getThread.mockResolvedValue(
        detailWith(
          userRecord('message-1', 'Improve this case', {
            attachedCases: [{ id: 'tc-1', name: 'Valid login redirects to dashboard', suiteName: 'Authentication' }],
          }),
          assistantRecord('message-2', 'Here is an updated version', {
            suggestedCases: [
              {
                title: 'Valid login lands on the dashboard',
                objective: 'Verify login',
                preconditions: [],
                steps: ['Log in'],
                expectedResult: 'Dashboard is shown',
                priority: 'high',
                targetTestCaseId: 'tc-1',
              },
            ],
          }),
        ),
      )
      sendToReview.mockResolvedValue({ proposalId: 'proposal-1' })
      const user = userEvent.setup()

      await renderPanel()
      await openThread(user)

      expect(await screen.findByText('Updates: Valid login redirects to dashboard')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /send to review/i }))

      expect(sendToReview).toHaveBeenCalledWith('proj-1', 'thread-1', 'message-2', 0)
      expect(await screen.findByRole('link', { name: /view in review queue|review queue/i })).toBeInTheDocument()
    })

    it('keeps the scroll-to-latest control out of reach while the thread is at the bottom', async () => {
      listThreads.mockResolvedValue([chatThread])
      getThread.mockResolvedValue(threadDetailAfterReply)
      const user = userEvent.setup()

      await renderPanel()
      await openThread(user)
      await screen.findByText('There are 4 cases pending review.')

      const scrollToLatest = screen.getByRole('button', { name: /scroll to the latest message/i })
      expect(scrollToLatest).toBeDisabled()
      expect(scrollToLatest).toHaveClass('disabled:hidden')
    })
  })
})
