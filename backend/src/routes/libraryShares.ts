import express from 'express';
import prisma from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { requireFeature } from '../middleware/featureFlag';
import { COLLABORATION_SHARING_FLAG } from '../lib/featureFlags';
import { LibraryShareService } from '../services/libraryShare.service';

const router = express.Router();

router.use(authenticate);
router.use(requireFeature(COLLABORATION_SHARING_FLAG));

router.post('/:id/shares', async (req, res) => {
  try {
    const userId = req.user!.id;
    const folderId = req.params.id;
    const { inviteeEmail } = req.body as { inviteeEmail?: string };

    if (!inviteeEmail) {
      return res.status(400).json({
        error: { message: 'inviteeEmail is required' },
      });
    }

    const share = await LibraryShareService.shareLibrary({
      ownerId: userId,
      folderId,
      inviteeEmail,
    });

    res.status(201).json({
      message: 'Library shared successfully',
      share,
    });
  } catch (error) {
    console.error('Share library error:', error);

    if (error instanceof Error) {
      const message = error.message;
      if (message.includes('not found')) {
        return res.status(404).json({ error: { message } });
      }

      if (message.includes('rate limit')) {
        return res.status(429).json({ error: { message } });
      }

      return res.status(400).json({ error: { message } });
    }

    res.status(500).json({ error: { message: 'Failed to share library' } });
  }
});

router.delete('/:id/shares/:shareId', async (req, res) => {
  try {
    const userId = req.user!.id;
    const folderId = req.params.id;
    const shareId = req.params.shareId;

    await LibraryShareService.revokeShare({
      ownerId: userId,
      folderId,
      shareId,
    });

    res.json({
      message: 'Share revoked successfully',
    });
  } catch (error) {
    console.error('Revoke share error:', error);

    if (error instanceof Error) {
      const message = error.message;
      if (message.includes('not found')) {
        return res.status(404).json({ error: { message } });
      }

      return res.status(400).json({ error: { message } });
    }

    res.status(500).json({ error: { message: 'Failed to revoke share' } });
  }
});

router.get('/:id/shares', async (req, res) => {
  try {
    const userId = req.user!.id;
    const folderId = req.params.id;

    const shares = await LibraryShareService.listSharesForOwner(userId, folderId);

    res.json({
      shares,
    });
  } catch (error) {
    console.error('List shares error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({ error: { message: error.message } });
    }

    res.status(500).json({ error: { message: 'Failed to fetch shares' } });
  }
});

router.get('/shared-with-me', async (req, res) => {
  try {
    const userId = req.user!.id;

    const shares = await LibraryShareService.listSharedWithUser(userId);

    res.json({ shares });
  } catch (error) {
    console.error('List shared-with-me error:', error);
    res.status(500).json({ error: { message: 'Failed to fetch shared libraries' } });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const userId = req.user!.id;
    const folderId = req.params.id;

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        _count: {
          select: {
            prompts: true,
          },
        },
      },
    });

    if (!folder) {
      return res.status(404).json({ error: { message: 'Library not found' } });
    }

    if (folder.userId !== userId) {
      const hasAccess = await LibraryShareService.userHasViewerAccess(userId, folderId);
      if (!hasAccess) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
    }

    res.json({
      library: {
        id: folder.id,
        name: folder.name,
        owner: folder.user,
        promptCount: folder._count.prompts,
        updatedAt: folder.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get shared library error:', error);
    res.status(500).json({ error: { message: 'Failed to fetch library' } });
  }
});

router.get('/:id/prompts', async (req, res) => {
  try {
    const userId = req.user!.id;
    const folderId = req.params.id;

    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!folder) {
      return res.status(404).json({ error: { message: 'Library not found' } });
    }

    if (folder.userId !== userId) {
      const hasAccess = await LibraryShareService.userHasViewerAccess(userId, folderId);
      if (!hasAccess) {
        return res.status(403).json({ error: { message: 'Access denied' } });
      }
    }

    const prompts = await prisma.prompt.findMany({
      where: { folderId },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            executions: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ prompts });
  } catch (error) {
    console.error('Get shared prompts error:', error);
    res.status(500).json({ error: { message: 'Failed to fetch prompts' } });
  }
});

export default router;
