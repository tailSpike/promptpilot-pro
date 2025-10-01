import prisma from '../../lib/prisma';
import { LibraryShareService } from '../../services/libraryShare.service';

describe('LibraryShareService', () => {
  let ownerId: string;
  let inviteeId: string;
  let folderId: string;
  const consoleCalls: unknown[][] = [];
  let originalConsoleInfo: typeof console.info;

  beforeAll(async () => {
    originalConsoleInfo = console.info;
    console.info = (...args: unknown[]) => {
      consoleCalls.push(args);
    };

  const owner = await prisma.user.create({
      data: {
        email: 'share-owner@example.com',
        name: 'Share Owner',
        password: 'hashedpassword',
      },
    });
    ownerId = owner.id;

    const invitee = await prisma.user.create({
      data: {
        email: 'share-invitee@example.com',
        name: 'Share Invitee',
        password: 'hashedpassword',
      },
    });
    inviteeId = invitee.id;

    const folder = await prisma.folder.create({
      data: {
        name: 'Owner Library',
        userId: ownerId,
      },
    });
    folderId = folder.id;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { actorId: ownerId },
    });
    await prisma.promptLibraryShare.deleteMany({
      where: { folderId },
    });
    await prisma.folder.delete({ where: { id: folderId } });
    await prisma.user.delete({ where: { id: ownerId } });
    await prisma.user.delete({ where: { id: inviteeId } });
    console.info = originalConsoleInfo;
  });

  afterEach(async () => {
    consoleCalls.length = 0;
    await prisma.auditLog.deleteMany({
      where: { actorId: ownerId },
    });
    await prisma.promptLibraryShare.deleteMany({
      where: { folderId },
    });
  });

  it('shares a library with a viewer and records telemetry', async () => {
    const share = await LibraryShareService.shareLibrary({
      ownerId,
      folderId,
      inviteeEmail: 'share-invitee@example.com',
    });

    expect(share.folder.id).toBe(folderId);
    expect(share.invitedUser.id).toBe(inviteeId);
    expect(
      consoleCalls.some(
        ([label, payload]) =>
          label === '[email] share-invite' &&
          typeof payload === 'object' &&
          payload !== null &&
          (payload as { to: string }).to === 'share-invitee@example.com',
      ),
    ).toBe(true);

    const sharedEvent = consoleCalls.find(
      ([label, eventName]) => label === '[analytics]' && eventName === 'collaboration.library.shared',
    );

    expect(sharedEvent).toBeDefined();
    if (sharedEvent) {
      const [, , rawPayload] = sharedEvent;
  const payload = (typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload) as Record<string, unknown>;
  expect(payload.workspaceId).toBe('workspace-default');
  expect(payload.folderId).toBe(folderId);
  expect(payload.ownerId).toBe(ownerId);
  expect(payload.inviteeId).toBe(inviteeId);
    }

    const auditEvents = await prisma.auditLog.findMany({
      where: {
        actorId: ownerId,
        action: 'library.share.created',
        targetId: folderId,
      },
    });
    expect(auditEvents).toHaveLength(1);
  });

  it('prevents duplicate active invites', async () => {
    await LibraryShareService.shareLibrary({ ownerId, folderId, inviteeEmail: 'share-invitee@example.com' });

    await expect(
      LibraryShareService.shareLibrary({ ownerId, folderId, inviteeEmail: 'share-invitee@example.com' }),
    ).rejects.toThrow('User already has access to this library');
  });

  it('reactivates soft-deleted invites instead of duplicating records', async () => {
    const share = await LibraryShareService.shareLibrary({ ownerId, folderId, inviteeEmail: 'share-invitee@example.com' });

    await LibraryShareService.revokeShare({ ownerId, folderId, shareId: share.id });

    const reactivated = await LibraryShareService.shareLibrary({
      ownerId,
      folderId,
      inviteeEmail: 'share-invitee@example.com',
    });

    expect(reactivated.id).toBe(share.id);
    expect(reactivated.deletedAt).toBeNull();
  });

  it('enforces invite rate limiting per hour', async () => {
    const additionalUsers = await Promise.all(
      Array.from({ length: 20 }).map((_, index) =>
        prisma.user.create({
          data: {
            email: `rate-limit-user-${index}@example.com`,
            password: 'hashedpassword',
          },
        }),
      ),
    );

    for (const user of additionalUsers) {
      await LibraryShareService.shareLibrary({ ownerId, folderId, inviteeEmail: user.email });
    }

    await prisma.user.create({
      data: {
        email: 'beyond-limit@example.com',
        password: 'hashedpassword',
      },
    });

    await expect(
      LibraryShareService.shareLibrary({ ownerId, folderId, inviteeEmail: 'beyond-limit@example.com' }),
    ).rejects.toThrow('Invite rate limit reached. Try again later.');

    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'rate-limit-user-',
        },
      },
    });
    await prisma.user.delete({ where: { email: 'beyond-limit@example.com' } });
    await prisma.promptLibraryShare.deleteMany({ where: { folderId } });
  });

  it('revokes access and records audit trail', async () => {
    const share = await LibraryShareService.shareLibrary({ ownerId, folderId, inviteeEmail: 'share-invitee@example.com' });

    const revoked = await LibraryShareService.revokeShare({ ownerId, folderId, shareId: share.id });

    expect(revoked.deletedAt).not.toBeNull();
    expect(revoked.revokedById).toBe(ownerId);
    const revokedEvent = consoleCalls.find(
      ([label, eventName]) =>
        label === '[analytics]' && eventName === 'collaboration.library.share.revoked',
    );

    expect(revokedEvent).toBeDefined();
    if (revokedEvent) {
      const [, , rawPayload] = revokedEvent;
  const payload = (typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload) as Record<string, unknown>;
  expect(payload.workspaceId).toBe('workspace-default');
  expect(payload.folderId).toBe(folderId);
  expect(payload.ownerId).toBe(ownerId);
  expect(payload.inviteeId).toBe(inviteeId);
    }

    const auditEvents = await prisma.auditLog.findMany({
      where: {
        actorId: ownerId,
        action: 'library.share.revoked',
        targetId: folderId,
      },
    });
    expect(auditEvents).toHaveLength(1);
  });

  it('returns shared libraries for an invitee', async () => {
    await LibraryShareService.shareLibrary({ ownerId, folderId, inviteeEmail: 'share-invitee@example.com' });

    const shares = await LibraryShareService.listSharedWithUser(inviteeId);

    expect(shares).toHaveLength(1);
    expect(shares[0]?.folder.id).toBe(folderId);
    expect(shares[0]?.invitedBy.id).toBe(ownerId);
  });

  it('confirms viewer access helper respects revoked shares', async () => {
    const share = await LibraryShareService.shareLibrary({ ownerId, folderId, inviteeEmail: 'share-invitee@example.com' });

    expect(await LibraryShareService.userHasViewerAccess(inviteeId, folderId)).toBe(true);

    await LibraryShareService.revokeShare({ ownerId, folderId, shareId: share.id });

    expect(await LibraryShareService.userHasViewerAccess(inviteeId, folderId)).toBe(false);
  });
});
