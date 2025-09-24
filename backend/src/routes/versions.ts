import express from 'express';
import { authenticate } from '../middleware/auth';
import { VersionService, VersionChangeType } from '../services/versionService';

const router = express.Router();

// All version routes require authentication
router.use(authenticate);

/**
 * GET /api/prompts/:promptId/versions
 * Get version history for a prompt
 */
router.get('/prompts/:promptId/versions', async (req, res) => {
  try {
    const { promptId } = req.params;
    const userId = req.user!.id;

    const versions = await VersionService.getVersionHistory(promptId, userId);
    res.json({ success: true, data: versions });
  } catch (error: any) {
    res.status(400).json({ 
      success: false, 
      error: { message: error.message } 
    });
  }
});

/**
 * GET /api/versions/:versionId
 * Get a specific version
 */
router.get('/versions/:versionId', async (req, res) => {
  try {
    const { versionId } = req.params;
    const userId = req.user!.id;

    const version = await VersionService.getVersion(versionId, userId);
    res.json({ success: true, data: version });
  } catch (error: any) {
    res.status(400).json({ 
      success: false, 
      error: { message: error.message } 
    });
  }
});

/**
 * POST /api/prompts/:promptId/versions
 * Create a new version of a prompt
 */
router.post('/prompts/:promptId/versions', async (req, res) => {
  try {
    const { promptId } = req.params;
    const { changeType, commitMessage, parentVersionId } = req.body;
    const userId = req.user!.id;

    // Validate changeType if provided
    if (changeType && !Object.values(VersionChangeType).includes(changeType)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid change type. Must be PATCH, MINOR, or MAJOR' }
      });
    }

    const version = await VersionService.createVersion({
      promptId,
      userId,
      changeType: changeType || VersionChangeType.PATCH,
      commitMessage,
      parentVersionId
    });

    res.status(201).json({ success: true, data: version });
  } catch (error: any) {
    res.status(400).json({ 
      success: false, 
      error: { message: error.message } 
    });
  }
});

/**
 * PUT /api/prompts/:promptId/revert/:versionId
 * Revert a prompt to a specific version
 */
router.put('/prompts/:promptId/revert/:versionId', async (req, res) => {
  try {
    const { promptId, versionId } = req.params;
    const userId = req.user!.id;

    const prompt = await VersionService.revertToVersion(promptId, versionId, userId);
    res.json({ success: true, data: prompt });
  } catch (error: any) {
    res.status(400).json({ 
      success: false, 
      error: { message: error.message } 
    });
  }
});

/**
 * GET /api/versions/:version1Id/compare/:version2Id
 * Compare two versions
 */
router.get('/versions/:version1Id/compare/:version2Id', async (req, res) => {
  try {
    const { version1Id, version2Id } = req.params;
    const userId = req.user!.id;

    const diffs = await VersionService.compareVersions(version1Id, version2Id, userId);
    res.json({ success: true, data: diffs });
  } catch (error: any) {
    res.status(400).json({ 
      success: false, 
      error: { message: error.message } 
    });
  }
});

/**
 * GET /api/prompts/:promptId/versions/stats
 * Get version statistics for a prompt
 */
router.get('/prompts/:promptId/versions/stats', async (req, res) => {
  try {
    const { promptId } = req.params;
    const userId = req.user!.id;

    const stats = await VersionService.getVersionStats(promptId, userId);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(400).json({ 
      success: false, 
      error: { message: error.message } 
    });
  }
});

export default router;