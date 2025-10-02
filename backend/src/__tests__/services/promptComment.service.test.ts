import prisma from '../../lib/prisma';
import { PromptCommentService } from '../../services/promptComment.service';
import { AnalyticsService, type AnalyticsEvent } from '../../services/analytics.service';

describe('PromptCommentService', () => {
  let ownerId: string;
  let viewerId: string;
  let outsiderId: string;
  let folderId: string;
  let promptId: string;

  const analyticsEvents: AnalyticsEvent[] = [];
  const consoleCalls: unknown[][] = [];
  let analyticsSpy: jest.SpyInstance;
  let consoleSpy: jest.SpyInstance;

  beforeAll(async () => {
    const owner = await prisma.user.create({
      data: {
        email: 'comment-owner@example.com',
        name: 'Comment Owner',
        password: 'hashedpassword',
      },
    });
    ownerId = owner.id;

    const viewer = await prisma.user.create({
      data: {
        email: 'comment-viewer@example.com',
        name: 'Comment Viewer',
        password: 'hashedpassword',
      },
    });
    viewerId = viewer.id;

    const outsider = await prisma.user.create({
      data: {
        email: 'comment-outsider@example.com',
        name: 'Comment Outsider',
        password: 'hashedpassword',
      },
    });
    outsiderId = outsider.id;

    const folder = await prisma.folder.create({
      data: {
        name: 'Shared Library For Comments',
        userId: ownerId,
      },
    });
    folderId = folder.id;

    await prisma.promptLibraryShare.create({
      data: {
        folderId,
        invitedUserId: viewerId,
        invitedById: ownerId,
        role: 'VIEWER',
      },
    });

    const prompt = await prisma.prompt.create({
      data: {
        name: 'Shared prompt',
        content: 'Hello world',
        variables: [],
        metadata: {},
        userId: ownerId,
        folderId,
      },
    });
    promptId = prompt.id;
  });

  beforeEach(() => {
    analyticsEvents.length = 0;
    consoleCalls.length = 0;
    analyticsSpy = jest.spyOn(AnalyticsService, 'track').mockImplementation(async (event) => {
      analyticsEvents.push(event);
    });
    consoleSpy = jest.spyOn(console, 'info').mockImplementation((...args: unknown[]) => {
      consoleCalls.push(args);
    });
  });

  afterEach(async () => {
    analyticsSpy?.mockRestore();
    consoleSpy?.mockRestore();
    await prisma.auditLog.deleteMany({ where: { targetId: promptId } });
    await prisma.promptComment.deleteMany({ where: { promptId } });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { targetId: promptId } });
    await prisma.promptComment.deleteMany({ where: { promptId } });
    await prisma.promptLibraryShare.deleteMany({ where: { folderId } });
    await prisma.prompt.delete({ where: { id: promptId } });
    await prisma.folder.delete({ where: { id: folderId } });
    await prisma.user.delete({ where: { id: ownerId } });
    await prisma.user.delete({ where: { id: viewerId } });
    await prisma.user.delete({ where: { id: outsiderId } });
  });

  it('allows owners and shared viewers to list comments while denying outsiders', async () => {
    const created = await PromptCommentService.createComment({
      promptId,
      userId: ownerId,
      body: 'Owner note',
    });

    const ownerResult = await PromptCommentService.listComments(promptId, ownerId);
    expect(ownerResult.libraryId).toBe(folderId);
    expect(ownerResult.comments.map((comment) => comment.id)).toContain(created.id);

    const viewerResult = await PromptCommentService.listComments(promptId, viewerId);
    expect(viewerResult.comments).toHaveLength(1);
    expect(viewerResult.comments[0]?.id).toBe(created.id);

    await expect(PromptCommentService.listComments(promptId, outsiderId)).rejects.toThrow('Access denied');
  });

  it('sanitises created comments, records audit logs, and fires analytics plus notification for viewers', async () => {
    const comment = await PromptCommentService.createComment({
      promptId,
      userId: viewerId,
      body: '  <script>alert("xss")</script>  ',
    });

    expect(comment.author.id).toBe(viewerId);
    expect(comment.body).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');

    const auditEvents = await prisma.auditLog.findMany({
      where: {
        actorId: viewerId,
        action: 'comment.created',
        targetId: promptId,
      },
    });
    expect(auditEvents).toHaveLength(1);
    const metadata = auditEvents[0]?.metadata as Record<string, unknown> | undefined;
    expect(metadata).toMatchObject({ commentId: comment.id, libraryId: folderId });

    const createdEvent = analyticsEvents.find((event) => event.name === 'collaboration.comment.created');
    expect(createdEvent).toBeDefined();
    if (createdEvent) {
      expect(createdEvent.payload).toMatchObject({
        workspaceId: 'workspace-default',
        actorId: viewerId,
        promptId,
        libraryId: folderId,
        isOwner: false,
      });
    }

    const notificationCall = consoleCalls.find(
      ([label, eventName]) => label === '[notification]' && eventName === 'comment.created',
    );
    expect(notificationCall).toBeDefined();
    if (notificationCall) {
      const payload = typeof notificationCall[2] === 'string' ? JSON.parse(notificationCall[2] as string) : notificationCall[2];
      expect(payload).toMatchObject({ ownerId, promptId, commentId: comment.id });
    }
  });

  it('rejects empty comment bodies', async () => {
    await expect(
      PromptCommentService.createComment({ promptId, userId: viewerId, body: '   ' }),
    ).rejects.toThrow('Comment body cannot be empty');
  });

  it('enforces the per-user hourly rate limit', async () => {
    const limit = Number.parseInt(process.env.COMMENT_RATE_LIMIT_PER_HOUR ?? '30', 10);
    for (let index = 0; index < limit; index += 1) {
      await PromptCommentService.createComment({
        promptId,
        userId: viewerId,
        body: `Viewer comment ${index}`,
      });
    }

    await expect(
      PromptCommentService.createComment({ promptId, userId: viewerId, body: 'Beyond limit' }),
    ).rejects.toThrow('Comment rate limit reached. Try again later.');
  });

  it('allows authors or prompt owners to delete comments while logging analytics', async () => {
    const viewerComment = await PromptCommentService.createComment({
      promptId,
      userId: viewerId,
      body: 'Please remove me',
    });

    await expect(PromptCommentService.deleteComment(viewerComment.id, outsiderId)).rejects.toThrow('Access denied');

    const stillAlive = await prisma.promptComment.findUnique({ where: { id: viewerComment.id } });
    expect(stillAlive?.deletedAt).toBeNull();

    const deleted = await PromptCommentService.deleteComment(viewerComment.id, ownerId);
    expect(deleted.deletedAt).not.toBeNull();

    const deleteAudit = await prisma.auditLog.findMany({
      where: {
        actorId: ownerId,
        action: 'comment.deleted',
        targetId: promptId,
      },
    });
    expect(deleteAudit).toHaveLength(1);

    const deleteEvent = analyticsEvents.find((event) => event.name === 'collaboration.comment.deleted');
    expect(deleteEvent).toBeDefined();
    if (deleteEvent) {
      expect(deleteEvent.payload).toMatchObject({
        workspaceId: 'workspace-default',
        actorId: ownerId,
        promptId,
        libraryId: folderId,
        isOwner: true,
        isAuthor: false,
      });
    }
  });
});