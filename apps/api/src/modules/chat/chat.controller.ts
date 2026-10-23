import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Res,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { isErr, type Result } from '../../common/result';
import { AiEntitlementGuard } from '../ai/guards/ai-entitlement.guard';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import type {
  ChatError,
  ChatMessageView,
  ChatStreamEvent,
  ChatThreadDetailView,
  ChatThreadView,
  SendToReviewView,
} from './chat.contracts';
import {
  createThreadSchema,
  sendMessageSchema,
  sendToReviewSchema,
  type CreateThreadInput,
  type SendMessageInput,
  type SendToReviewInput,
} from './chat.schemas';
import { ChatService } from './chat.service';

function chatException(error: ChatError): HttpException {
  switch (error) {
    case 'project-not-found':
      return new NotFoundException({
        code: error,
        message: 'Project not found',
      });
    case 'thread-not-found':
      return new NotFoundException({
        code: error,
        message: 'Conversation not found',
      });
    case 'message-not-found':
      return new NotFoundException({
        code: error,
        message: 'Message not found',
      });
    case 'case-not-found':
      return new NotFoundException({
        code: error,
        message:
          'The requested case was not found in this project, or the assistant did not suggest one at that position',
      });
    case 'missing-suite':
      return new UnprocessableEntityException({
        code: error,
        message: 'This project has no suite to receive the proposal',
      });
    case 'provider-unavailable':
      return new ServiceUnavailableException({
        code: error,
        message: 'The AI assistant is not available right now',
      });
    case 'ai-not-enabled':
      return new ForbiddenException({
        code: error,
        message: 'AI features are not enabled for this organization',
      });
    case 'quota-exhausted':
      return new ServiceUnavailableException({
        code: error,
        message:
          'The daily Aeris limit was reached. Your message was saved — try again tomorrow.',
      });
    case 'invalid-suggested-cases':
      return new UnprocessableEntityException({
        code: error,
        message: 'The stored suggested cases for this message are corrupt',
      });
    case 'human-documented':
      return new ConflictException({
        code: error,
        message: 'This case was documented by a person and cannot be targeted',
      });
    case 'too-many-cases':
      return new BadRequestException({
        code: error,
        message: 'Too many cases attached to this message',
      });
    case 'no-code-evidence':
      return new UnprocessableEntityException({
        code: error,
        message: 'This suggestion has no code-backed evidence to send',
      });
    case 'file-unreadable':
      return new UnprocessableEntityException({
        code: error,
        message: 'The attached file could not be read from the repository',
      });
  }
}

function unwrap<T>(result: Result<T, ChatError>): T {
  if (!isErr(result)) return result.value;
  throw chatException(result.error);
}

const SSE_HEADERS: Readonly<Record<string, string>> = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

const INTERNAL_STREAM_ERROR = {
  code: 'internal-error',
  message: 'Internal server error',
};

const logger = new Logger('ChatController');

function writeEvent(response: Response, name: string, data: unknown): void {
  if (response.destroyed || response.writableEnded) return;
  response.write(`event: ${name}
data: ${JSON.stringify(data)}

`);
}

function writeStreamEvent(response: Response, event: ChatStreamEvent): void {
  switch (event.type) {
    case 'delta':
      writeEvent(response, 'delta', { text: event.text });
      return;
    case 'done':
      writeEvent(response, 'done', {
        userMessage: event.userMessage,
        assistantMessage: event.assistantMessage,
      });
      return;
    case 'failed':
      writeEvent(response, 'error', chatException(event.error).getResponse());
      return;
  }
}

@Controller('projects/:projectId/chat/threads')
@UseGuards(OrgScopeGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  async list(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
  ): Promise<ChatThreadView[]> {
    return unwrap(await this.chat.listThreads(org, user, projectId));
  }

  @Post()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async create(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(createThreadSchema)) body: CreateThreadInput,
  ): Promise<ChatThreadView> {
    return unwrap(await this.chat.createThread(org, user, projectId, body));
  }

  @Get(':threadId')
  async get(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('threadId') threadId: string,
  ): Promise<ChatThreadDetailView> {
    return unwrap(await this.chat.getThread(org, user, projectId, threadId));
  }

  @Delete(':threadId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('threadId') threadId: string,
  ): Promise<void> {
    unwrap(await this.chat.deleteThread(org, user, projectId, threadId));
  }

  @Post(':threadId/messages')
  @UseGuards(AiEntitlementGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async send(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('threadId') threadId: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) body: SendMessageInput,
  ): Promise<ChatMessageView> {
    return unwrap(
      await this.chat.sendMessage(org, user, projectId, threadId, body),
    );
  }

  /**
   * The streamed variant of send, over server-sent events. The first event is
   * awaited before any header is written, so a send refused before the reply
   * started answers with exactly the HTTP error send would. Once the 200 is
   * on the wire, a failure can only go out as an `error` event.
   */
  @Post(':threadId/messages/stream')
  @UseGuards(AiEntitlementGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async sendStream(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('threadId') threadId: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) body: SendMessageInput,
    @Res() response: Response,
  ): Promise<void> {
    // A close before the response finished means the client went away: stop
    // the provider request so the unfinished reply is never paid for.
    const abort = new AbortController();
    response.on('close', () => {
      if (!response.writableFinished) abort.abort();
    });

    const events = this.chat.streamMessage(
      org,
      user,
      projectId,
      threadId,
      body,
      abort.signal,
    );
    const first = await events.next();
    if (first.done === true) {
      response.end();
      return;
    }
    if (first.value.type === 'failed') throw chatException(first.value.error);

    response.status(HttpStatus.OK);
    for (const [name, value] of Object.entries(SSE_HEADERS)) {
      response.setHeader(name, value);
    }
    response.flushHeaders();

    try {
      writeStreamEvent(response, first.value);
      // The generator is its own iterator: this resumes after the first event.
      for await (const event of events) {
        writeStreamEvent(response, event);
      }
    } catch (error) {
      logger.error(
        `Chat stream on thread ${threadId} failed after it started`,
        error instanceof Error ? error.stack : String(error),
      );
      writeEvent(response, 'error', INTERNAL_STREAM_ERROR);
    }
    response.end();
  }

  @Post(':threadId/messages/:messageId/proposals')
  @HttpCode(HttpStatus.CREATED)
  async sendToReview(
    @CurrentOrg() org: OrgContext,
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId') projectId: string,
    @Param('threadId') threadId: string,
    @Param('messageId') messageId: string,
    @Body(new ZodValidationPipe(sendToReviewSchema)) body: SendToReviewInput,
  ): Promise<SendToReviewView> {
    return unwrap(
      await this.chat.sendToReview(
        org,
        user,
        projectId,
        threadId,
        messageId,
        body,
      ),
    );
  }
}
