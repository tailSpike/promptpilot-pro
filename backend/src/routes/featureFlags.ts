import express from 'express';
import { authenticate } from '../middleware/auth';
import { getFeatureFlags } from '../lib/featureFlags';

const router = express.Router();

router.use(authenticate);

router.get('/', (_req, res) => {
  res.json({ flags: getFeatureFlags() });
});

export default router;
