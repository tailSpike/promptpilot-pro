import { subHours } from 'date-fns';
import prisma from '../lib/prisma';
import { LibraryShareService } from './libraryShare.service';
import { AuditService } from './audit.service';
import { AnalyticsService } from './analytics.service';

const DEFAULT_WORKSPACE_ID = process.env.DEFAULT_WORKSPACE_ID ?? 'workspace-default';

const COMMENT_RATE_LIMIT_PER_HOUR = Number.parseInt(
  process.env.COMMENT_RATE_LIMIT_PER_HOUR ?? '30',
  10,
);

const MAX_COMMENT_LENGTH = 2000;

function clampRateLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) {
    return 30;
  }
  return limit;
}

const RATE_LIMIT = clampRateLimit(COMMENT_RATE_LIMIT_PER_HOUR);

function sanitiseBody(raw: string): string {
  const trimmed = raw.trim();
  // Basic HTML escaping to avoid accidental markup when rendered elsewhere.
  return trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function ensurePromptAccessible(
  promptId: string,
  userId: string,
): Promise<{
  promptId: string;
  ownerId: string;
  libraryId: string;
  isOwner: boolean;
}> {
  const prompt = await prisma.prompt.findFirst({
    where: {
      id: promptId,
    },
    select: {
      id: true,
      userId: true,
      folderId: true,
    },
  });

  if (!prompt) {
    throw new Error('Prompt not found');
  }

  if (!prompt.folderId) {
    throw new Error('Comments are only supported for shared libraries');
  }

  const isOwner = prompt.userId === userId;

  if (!isOwner) {
    const hasAccess = await LibraryShareService.userHasViewerAccess(userId, prompt.folderId);
    if (!hasAccess) {
      throw new Error('Access denied');
    }
  }

  return {
    promptId: prompt.id,
    ownerId: prompt.userId,
    libraryId: prompt.folderId,
    isOwner,
  };
}

export class PromptCommentService {
  static async listComments(promptId: string, userId: string) {
    const { libraryId } = await ensurePromptAccessible(promptId, userId);

    const comments = await prisma.promptComment.findMany({
      where: {
        promptId,
        deletedAt: null,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      libraryId,
      comments,
    };
  }

  static async createComment(options: { promptId: string; userId: string; body: string }) {
    const { promptId, userId } = options;
    const body = sanitiseBody(options.body ?? '');

    if (!body) {
      throw new Error('Comment body cannot be empty');
    }

    if (body.length > MAX_COMMENT_LENGTH) {
      throw new Error(`Comment body cannot exceed ${MAX_COMMENT_LENGTH} characters`);
    }

    const { libraryId, ownerId, isOwner } = await ensurePromptAccessible(promptId, userId);

    const since = subHours(new Date(), 1);
    const commentCount = await prisma.promptComment.count({
      where: {
        authorId: userId,
        createdAt: { gte: since },
        deletedAt: null,
      },
    });

    if (commentCount >= RATE_LIMIT) {
      throw new Error('Comment rate limit reached. Try again later.');
    }

    const comment = await prisma.promptComment.create({
      data: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        promptId,
        libraryId,
        authorId: userId,
        body,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await AuditService.record({
      actorId: userId,
      action: 'comment.created',
      targetType: 'prompt',
      targetId: promptId,
      metadata: {
        commentId: comment.id,
        libraryId,
      },
    });

    await AnalyticsService.track({
      name: 'collaboration.comment.created',
      payload: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        actorId: userId,
        promptId,
        libraryId,
        isOwner,
      },
    });

    if (userId !== ownerId) {
      // Fire-and-forget toast notification hook stub. In a real implementation this
      // would integrate with the notification service.
      console.info('[notification]', 'comment.created', JSON.stringify({
        ownerId,
        promptId,
        commentId: comment.id,
      }));
    }

    return comment;
  }

  static async deleteComment(commentId: string, userId: string) {
    const existing = await prisma.promptComment.findFirst({
      where: {
        id: commentId,
        deletedAt: null,
      },
      include: {
        author: {
          select: {
            id: true,
          },
        },
        prompt: {
          select: {
            id: true,
            userId: true,
            folderId: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error('Comment not found');
    }

    if (!existing.prompt.folderId) {
      throw new Error('Invalid library context');
    }

    const isAuthor = existing.author.id === userId;
    const isOwner = existing.prompt.userId === userId;

    if (!isAuthor && !isOwner) {
      throw new Error('Access denied');
    }

    const deleted = await prisma.promptComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    await AuditService.record({
      actorId: userId,
      action: 'comment.deleted',
      targetType: 'prompt',
      targetId: existing.prompt.id,
      metadata: {
        commentId,
        libraryId: existing.prompt.folderId,
      },
    });

    await AnalyticsService.track({
      name: 'collaboration.comment.deleted',
      payload: {
        workspaceId: DEFAULT_WORKSPACE_ID,
        actorId: userId,
        promptId: existing.prompt.id,
        libraryId: existing.prompt.folderId,
        isAuthor,
        isOwner,
      },
    });

    return deleted;
  }
}