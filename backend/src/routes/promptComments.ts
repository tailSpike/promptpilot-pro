import express from 'express';
import { authenticate } from '../middleware/auth';
import { requireFeature } from '../middleware/featureFlag';
import { COLLABORATION_COMMENTS_FLAG } from '../lib/featureFlags';
import { PromptCommentService } from '../services/promptComment.service';

const router = express.Router();

router.use(authenticate);
router.use(requireFeature(COLLABORATION_COMMENTS_FLAG));

router.delete('/:id', async (req, res) => {
  try {
    const commentId = req.params.id;
    const userId = req.user!.id;

    if (!commentId) {
      return res.status(400).json({
        error: { message: 'Comment ID is required' },
      });
    }

    await PromptCommentService.deleteComment(commentId, userId);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete prompt comment error:', error);
    res.status(400).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to delete comment',
      },
    });
  }
});

export default router;