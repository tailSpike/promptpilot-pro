import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/documents/:id/download - download a document if owned by user
router.get('/:id/download', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const id = req.params.id;
    const doc = await prisma.documentBlob.findUnique({ where: { id } });
    if (!doc || doc.ownerId !== userId) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.setHeader('Content-Type', doc.mimeType || 'text/plain');
    res.setHeader('Content-Length', Buffer.byteLength(doc.content, 'utf8').toString());
    res.setHeader('Content-Disposition', `attachment; filename="document-${doc.id}.txt"`);
    return res.send(doc.content);
  } catch (error) {
    console.error('Document download error:', error);
    return res.status(500).json({ error: 'Failed to download document' });
  }
});

export default router;
