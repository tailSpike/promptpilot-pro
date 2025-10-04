import { createLogger } from '../lib/logger';

const notificationLogger = createLogger('notification');

export interface CommentCreatedNotification {
  ownerId: string;
  promptId: string;
  commentId: string;
}

export class NotificationService {
  static emitPromptCommentCreated(payload: CommentCreatedNotification): void {
    notificationLogger.info('comment.created', payload);
  }
}