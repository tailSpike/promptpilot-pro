import { subHours } from 'date-fns';
import prisma from '../lib/prisma';
import { AuditService } from './audit.service';
import { AnalyticsService } from './analytics.service';
import { EmailService } from './email.service';

const SHARE_RATE_LIMIT_PER_HOUR = 20;

export class LibraryShareService {
  static async shareLibrary(options: { ownerId: string; folderId: string; inviteeEmail: string }) {
    const inviteeEmail = options.inviteeEmail.trim().toLowerCase();
    if (!inviteeEmail) {
      throw new Error('Invitee email is required');
    }

    const folder = await prisma.folder.findFirst({
      where: {
        id: options.folderId,
        userId: options.ownerId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    });

    if (!folder) {
      throw new Error('Library not found or access denied');
    }

    const invitee = await prisma.user.findUnique({
      where: { email: inviteeEmail },
    });

    if (!invitee) {
      throw new Error('Invitee not found');
    }

    if (invitee.id === options.ownerId) {
      throw new Error('You already own this library');
    }

    // Rate limiting: 20 invites per owner per rolling hour
    const since = subHours(new Date(), 1);
    const inviteCount = await prisma.promptLibraryShare.count({
      where: {
        invitedById: options.ownerId,
        createdAt: { gte: since },
        deletedAt: null,
      },
    });

    if (inviteCount >= SHARE_RATE_LIMIT_PER_HOUR) {
      throw new Error('Invite rate limit reached. Try again later.');
    }

    const existingShare = await prisma.promptLibraryShare.findUnique({
      where: {
        folderId_invitedUserId: {
          folderId: options.folderId,
          invitedUserId: invitee.id,
        },
      },
    });

    let share;

    if (existingShare) {
      if (!existingShare.deletedAt) {
        throw new Error('User already has access to this library');
      }

      share = await prisma.promptLibraryShare.update({
        where: { id: existingShare.id },
        data: {
          deletedAt: null,
          revokedById: null,
          createdAt: new Date(),
        },
        include: this.defaultShareInclude,
      });
    } else {
      share = await prisma.promptLibraryShare.create({
        data: {
          folderId: options.folderId,
          invitedUserId: invitee.id,
          invitedById: options.ownerId,
        },
        include: this.defaultShareInclude,
      });
    }

    await EmailService.sendLibraryShareInvite({
      toEmail: invitee.email,
      inviteeName: invitee.name,
      inviterName: folder.user.name ?? folder.user.email,
      libraryName: folder.name,
    });

    await AuditService.record({
      actorId: options.ownerId,
      action: 'library.share.created',
      targetType: 'folder',
      targetId: options.folderId,
      metadata: {
        shareId: share.id,
        inviteeId: invitee.id,
      },
    });

    await AnalyticsService.track({
      name: 'collaboration.library.shared',
      payload: {
        folderId: options.folderId,
        ownerId: options.ownerId,
        inviteeId: invitee.id,
      },
    });

    return share;
  }

  static async revokeShare(options: { ownerId: string; folderId: string; shareId: string }) {
    const share = await prisma.promptLibraryShare.findFirst({
      where: {
        id: options.shareId,
        folderId: options.folderId,
        deletedAt: null,
        folder: {
          userId: options.ownerId,
        },
      },
      include: this.defaultShareInclude,
    });

    if (!share) {
      throw new Error('Share not found or access denied');
    }

    const revoked = await prisma.promptLibraryShare.update({
      where: { id: share.id },
      data: {
        deletedAt: new Date(),
        revokedById: options.ownerId,
      },
      include: this.defaultShareInclude,
    });

    await AuditService.record({
      actorId: options.ownerId,
      action: 'library.share.revoked',
      targetType: 'folder',
      targetId: options.folderId,
      metadata: {
        shareId: share.id,
        inviteeId: share.invitedUserId,
      },
    });

    await AnalyticsService.track({
      name: 'collaboration.library.share.revoked',
      payload: {
        folderId: options.folderId,
        ownerId: options.ownerId,
        inviteeId: share.invitedUserId,
      },
    });

    return revoked;
  }

  static async listSharesForOwner(ownerId: string, folderId: string) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId: ownerId,
      },
    });

    if (!folder) {
      throw new Error('Library not found or access denied');
    }

    return prisma.promptLibraryShare.findMany({
      where: {
        folderId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: this.defaultShareInclude,
    });
  }

  static async listSharedWithUser(userId: string) {
    return prisma.promptLibraryShare.findMany({
      where: {
        invitedUserId: userId,
        deletedAt: null,
      },
      include: {
        folder: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
              },
            },
          },
        },
        invitedBy: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async userHasViewerAccess(userId: string, folderId: string) {
    if (!folderId) {
      return false;
    }

    const share = await prisma.promptLibraryShare.findFirst({
      where: {
        folderId,
        invitedUserId: userId,
        deletedAt: null,
      },
    });

    return Boolean(share);
  }

  private static readonly defaultShareInclude = {
    invitedUser: {
      select: {
        id: true,
        email: true,
        name: true,
      },
    },
    invitedBy: {
      select: {
        id: true,
        email: true,
        name: true,
      },
    },
    folder: {
      select: {
        id: true,
        name: true,
        updatedAt: true,
      },
    },
  } as const;
}
