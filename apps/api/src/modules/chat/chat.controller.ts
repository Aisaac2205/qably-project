import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { isErr, type Result } from '../../common/result';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrg } from '../organizations/decorators/current-org.decorator';
import { OrgScopeGuard } from '../organizations/guards/org-scope.guard';
import type { OrgContext } from '../organizations/organizations.contracts';
import type {
  ChatError,
  ChatMessageView,
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

function unwrap<T>(result: Result<T, ChatError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'project-not-found':
      throw new NotFoundException({
        code: result.error,
        message: 'Project not found',
      });
    case 'thread-not-found':
      throw new NotFoundException({
        code: result.error,
        message: 'Conversation not found',
      });
    case 'message-not-found':
      throw new NotFoundException({
        code: result.error,
        message: 'Message not found',
      });
    case 'case-not-found':
      throw new NotFoundException({
        code: result.error,
        message: 'The assistant did not suggest a case at that position',
      });
    case 'missing-suite':
      throw new UnprocessableEntityException({
        code: result.error,
        message: 'This project has no suite to receive the proposal',
      });
    case 'provider-unavailable':
      throw new ServiceUnavailableException({
        code: result.error,
        message: 'The AI assistant is not available right now',
      });
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

  @Post(':threadId/messages')
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
