import express from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../lib/prisma';
import { requireFeature } from '../middleware/featureFlag';
import { COLLABORATION_SHARING_FLAG } from '../lib/featureFlags';

const router = express.Router();

router.use(authenticate);
router.use(requireFeature(COLLABORATION_SHARING_FLAG));

router.get('/search', async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    if (query.length < 2) {
      return res.status(400).json({
        error: {
          message: 'Search query must be at least 2 characters',
        },
      });
    }

    const results = await prisma.user.findMany({
      where: {
        email: {
          contains: query,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
      take: 10,
    });

    res.json({ users: results });
  } catch (error) {
    console.error('User search error:', error);
    res.status(500).json({ error: { message: 'Failed to search users' } });
  }
});

export default router;
